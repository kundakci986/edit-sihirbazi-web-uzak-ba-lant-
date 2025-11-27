import librosa
import soundfile as sf
import subprocess
import json
import numpy as np
import tempfile
import os
import cv2

def extract_audio(video_path, out_wav):
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-ac", "1", "-ar", "44100",
        out_wav
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def detect_beats(y, sr):
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    return tempo, beats.tolist()

def detect_scenes(video_path):
    cap = cv2.VideoCapture(video_path)
    prev = None
    scenes = []
    idx = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev is not None:
            diff = cv2.absdiff(gray, prev)
            score = np.mean(diff)
            if score > 18:   # soft aesthetic threshold
                t = idx / fps
                scenes.append(t)
        prev = gray
        idx += 1

    cap.release()
    return scenes

def detect_motion(video_path):
    cap = cv2.VideoCapture(video_path)
    prev = None
    peaks = []
    idx = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    motion_curve = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev is not None:
            diff = cv2.absdiff(gray, prev)
            score = np.mean(diff)
            motion_curve.append(score)
        prev = gray
        idx += 1

    cap.release()

    motion_curve = np.array(motion_curve)
    thr = np.percentile(motion_curve, 88)  # top 12% = motion peak
    for i, v in enumerate(motion_curve):
        if v >= thr:
            peaks.append(i / fps)

    return peaks

def build_velocity_plan(video_path):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp.close()
    wav_path = tmp.name

    extract_audio(video_path, wav_path)
    y, sr = librosa.load(wav_path)
    tempo, beats = detect_beats(y, sr)
    scenes = detect_scenes(video_path)
    motion_peaks = detect_motion(video_path)

    os.remove(wav_path)

    # slow-mo pockets
    slowmo = []
    for i in range(len(motion_peaks)-1):
        a, b = motion_peaks[i], motion_peaks[i+1]
        if b - a > 0.45:  # long calm region
            slowmo.append([a, min(b, a+0.6)])

    return {
        "tempo": tempo,
        "beats": beats,
        "scenes": [{"start": s, "end": s+0.001} for s in scenes],
        "motion_peaks": motion_peaks,
        "slowmo": slowmo
    }

if __name__ == "__main__":
    import sys
    video_path = sys.argv[1]
    plan = build_velocity_plan(video_path)
    print(json.dumps(plan))
