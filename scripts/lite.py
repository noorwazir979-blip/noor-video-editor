"""Shared light helpers for noor-reel scripts: no PyTorch, no OpenCV.
Audio/video I/O goes through ffmpeg pipes, models run in onnxruntime.
Everything lives in ~/.local/share/reel-lite (see scripts/setup-lite.sh)."""
import os
import subprocess

import numpy as np

LITE = os.path.expanduser(os.environ.get("REEL_LITE", "~/.local/share/reel-lite"))
MODELS = os.path.join(LITE, "models")


def threads():
    # leave one core for the desktop; onnxruntime defaults to all of them
    return max(1, (os.cpu_count() or 2) - 1)


def session(name):
    import onnxruntime as ort

    o = ort.SessionOptions()
    o.intra_op_num_threads = threads()
    o.inter_op_num_threads = 1
    o.log_severity_level = 3  # hide harmless exporter warnings (UltraFace prints hundreds)
    return ort.InferenceSession(os.path.join(MODELS, name), o, providers=["CPUExecutionProvider"])


def read_audio_16k(path):
    """Mono float32 at 16 kHz via ffmpeg (any input: wav, mp4, mov)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def speech_spans(wav, threshold=0.5, neg_threshold=0.35, min_silence=0.3, min_speech=0.12):
    """Silero VAD v5 (ONNX, 2 MB) -> [(start_s, end_s)], streaming 32 ms
    windows with the model's recurrent state, hysteresis between threshold
    and neg_threshold, pauses shorter than min_silence bridged."""
    sess = session("silero_vad.onnx")
    sr = 16000
    win, ctx = 512, 64
    state = np.zeros((2, 1, 128), dtype=np.float32)
    context = np.zeros((1, ctx), dtype=np.float32)
    srs = np.array(sr, dtype=np.int64)
    probs = []
    for i in range(0, len(wav), win):
        chunk = wav[i : i + win]
        if len(chunk) < win:
            chunk = np.pad(chunk, (0, win - len(chunk)))
        x = np.concatenate([context, chunk[None, :]], axis=1).astype(np.float32)
        out, state = sess.run(None, {"input": x, "state": state, "sr": srs})
        context = x[:, -ctx:]
        probs.append(float(out.reshape(-1)[0]))
    step = win / sr
    spans = []
    on = False
    start = 0.0
    for k, p in enumerate(probs):
        t = k * step
        if not on and p >= threshold:
            on, start = True, t
        elif on and p < neg_threshold:
            on = False
            spans.append([start, t])
    if on:
        spans.append([start, len(probs) * step])
    merged = []
    for s, e in spans:
        if merged and s - merged[-1][1] < min_silence:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged if e - s >= min_speech]


def free_ram_gb():
    try:
        for line in open("/proc/meminfo"):
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) / 1024 / 1024
    except OSError:
        pass
    return 4.0
