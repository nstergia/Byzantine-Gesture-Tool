"""Agreement of the application's pitch detector (YIN, lib/core.mjs) with pYIN (librosa) on real voices.

For each file the audio is decoded to mono 48 kHz with ffmpeg, both detectors run on the same
4,096-sample frames every 110 ms (pYIN without centring, 65-1,000 Hz), and frames voiced in both
are compared in cents. pYIN is a reference here, not ground truth.
Requires: ffmpeg, Node.js 18+, Python 3 with librosa and numpy.
Usage: python3 bench/pyin_compare.py samples/teacher.mp4 samples/student_C_s1_take1_audio.webm samples/student_C_s1_take2_audio.webm samples/student_take.mp4 samples/student_B.mp4 samples/student_C.mp4 > bench/pyin-compare.json
"""
import json, os, subprocess, sys, tempfile
import numpy as np, librosa

HERE = os.path.dirname(os.path.abspath(__file__))
SR, N = 48000, 4096
HOP = round(0.110 * SR)

def compare(path):
    with tempfile.TemporaryDirectory() as d:
        raw = os.path.join(d, 'a.f32')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', raw], check=True)
        yin = json.loads(subprocess.run(['node', os.path.join(HERE, 'yin-frames.mjs'), raw],
                                        check=True, capture_output=True, text=True).stdout)
        x = np.fromfile(raw, dtype=np.float32)
    f0, voiced, _ = librosa.pyin(x, fmin=65, fmax=1000, sr=SR, frame_length=N, hop_length=HOP, center=False)
    n = min(len(yin), len(f0))
    diff, only_yin, only_pyin = [], 0, 0
    for i in range(n):
        a, b = yin[i], f0[i]
        va, vb = a > 0, bool(voiced[i]) and not np.isnan(b)
        if va and vb: diff.append(1200 * np.log2(a / b))
        elif va: only_yin += 1
        elif vb: only_pyin += 1
    d = np.abs(np.array(diff))
    folded = np.abs((np.array(diff) + 600) % 1200 - 600)
    return {'file': os.path.basename(path), 'frames': n, 'bothVoiced': len(diff), 'onlyYIN': only_yin, 'onlyPYIN': only_pyin,
            'medianAbsCents': round(float(np.median(d)), 1), 'within10': round(100 * float(np.mean(d <= 10)), 1),
            'within50': round(100 * float(np.mean(d <= 50)), 1), 'harmonicErrors': int(np.sum(d > 600)),
            'within50AfterOctaveFolding': round(100 * float(np.mean(folded <= 50)), 1)}

if __name__ == '__main__':
    print(json.dumps([compare(p) for p in sys.argv[1:]], indent=2))
