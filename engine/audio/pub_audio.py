"""Bande son générique d'une pub motion : musique rythmée + bruitages + voix.

Usage : python3 scripts/pub_audio.py <timing.json> <voix.wav> <sortie.wav>
Le fichier de minutage donne total, voiceOffset, scenes (dont la première scène rythmée = 2e scène),
sfx, et optionnellement bpm et chords ("tiltio", "warm", "bright").
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from sfx import BANK, SR, bandpass, highpass, lowpass, rng, t_axis  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TIMING, VOICE, OUT = (Path(a) for a in sys.argv[1:4])
T = json.loads(TIMING.read_text())
DUR = T["total"]
N = int(DUR * SR)
S = T["scenes"]


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if j > i >= 0:
        buf[i:j] += sig[: j - i] * gain


def hz(name):
    idx = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440 * 2 ** ((idx[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


# ---------- Musique : 118 bpm, pulsation électro légère ----------

BPM = T.get("bpm", 118)
BEAT = 60 / BPM
BAR = 4 * BEAT
PRESETS = {
    "tiltio": ([["A3", "C4", "E4", "G4"], ["F3", "A3", "C4", "E4"], ["C4", "E4", "G4", "B4"], ["G3", "B3", "D4", "F#4"]], ["A1", "F1", "C2", "G1"]),
    "warm": ([["D3", "F#3", "A3", "C#4"], ["B2", "D3", "F#3", "A3"], ["G3", "B3", "D4", "F#4"], ["A3", "C#4", "E4", "G4"]], ["D2", "B1", "G1", "A1"]),
    "bright": ([["E3", "G#3", "B3", "D#4"], ["C#3", "E3", "G#3", "B3"], ["A3", "C#4", "E4", "G#4"], ["B3", "D#4", "F#4", "A4"]], ["E2", "C#2", "A1", "B1"]),
}
CHORDS, BASS = PRESETS[T.get("chords", "tiltio")]
DROP = list(S.values())[1]  # la rythmique démarre sur la 2e scène (le logo)

pad = np.zeros(N)
stabs = np.zeros(N)
bass = np.zeros(N)
drums = np.zeros(N)

bar = 0
while bar * BAR < DUR:
    at = bar * BAR
    chord = CHORDS[bar % 4]
    # nappe
    tt = t_axis(BAR + 0.6)
    env = np.minimum(1, tt / 0.5) * np.clip((BAR + 0.6 - tt) / 0.6, 0, 1)
    s = sum(
        np.sin(2 * np.pi * hz(n) * (1 + d) * h * tt) / h**1.7 for n in chord for d in (-0.002, 0.002) for h in range(1, 5)
    )
    place(pad, s * env, at)
    # accords pincés sur le contretemps
    for k in range(8):
        a = at + k * BEAT / 2
        if k % 2 == 1 or k == 0:
            ts = t_axis(0.28)
            st = sum(np.sin(2 * np.pi * hz(n) * 2 * ts) for n in chord) * np.exp(-ts * 14)
            place(stabs, st, a, 0.8 if k % 2 else 0.5)
    # basse en croches
    for k in range(8):
        a = at + k * BEAT / 2
        tb = t_axis(BEAT / 2 * 0.9)
        f0 = hz(BASS[bar % 4])
        b = (np.sin(2 * np.pi * f0 * tb) + 0.3 * np.sin(2 * np.pi * 2 * f0 * tb)) * np.exp(-tb * 5)
        place(bass, b, a, 1.0 if k % 2 == 0 else 0.6)
    bar += 1

kick_t = t_axis(0.32)
kick = np.sin(2 * np.pi * (46 + 110 * np.exp(-kick_t * 35)) * kick_t) * np.exp(-kick_t * 10)
hat_t = t_axis(0.05)
hat = highpass(rng.normal(0, 1, len(hat_t)), 7000) * np.exp(-hat_t * 90)
clap_t = t_axis(0.18)
clap = bandpass(rng.normal(0, 1, len(clap_t)), 900, 4000) * np.exp(-clap_t * 22)
b = 0
while b * BEAT < DUR:
    at = b * BEAT
    place(drums, kick, at, 1.0)
    if b % 2 == 1:
        place(drums, clap, at, 0.35)
    place(drums, hat, at + BEAT / 2, 0.3)
    place(drums, hat, at + BEAT / 4, 0.12)
    place(drums, hat, at + 3 * BEAT / 4, 0.12)
    b += 1

pad = lowpass(pad, 1800)
stabs = lowpass(stabs, 3000)
bass = lowpass(bass, 400)

t = t_axis(DUR)[:N]


def ramp(a, z):
    return np.clip((t - a) / max(1e-3, z - a), 0, 1)


groove = ramp(DROP - 0.05, DROP + 0.05) * (1 - ramp(DUR - 3, DUR - 1.5))
intro_filter = lowpass(pad, 700)
music = (
    np.where(t < DROP, intro_filter * 1.2, pad * 0.7)
    + stabs * 0.35 * groove
    + bass * 0.8 * groove
    + drums * 0.55 * groove
)
music *= np.clip((DUR - t) / 2.0, 0, 1)

# ---------- Bruitages ----------

fx = np.zeros(N)
gains = {"ding": 0.9, "pop": 0.8, "send": 0.8, "whoosh": 0.7, "whoosh_down": 0.6, "click": 0.9, "key": 0.6, "tick": 0.7,
         "check": 0.8, "stamp": 1.1, "boom": 1.2, "riser": 0.8}
for name, at in T["sfx"]:
    sig = BANK[name]()
    if name == "riser":
        at -= 0  # le riser commence à « at » et monte jusqu'au logo
    place(fx, sig, at, gains[name])

# ---------- Voix ----------

voice = np.zeros(N)
NO_VOICE = str(VOICE) == "-"  # « - » = montage sans voix (musique + bruitages seulement)
if not NO_VOICE:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(VOICE), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    voice_src = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    place(voice, voice_src, T["voiceOffset"])
    voice /= np.max(np.abs(voice)) + 1e-9

# ---------- Mixage ----------

if NO_VOICE:
    duck = 1.0
    v_rms = 0.25
    music_level, fx_level = 0.85, 0.95
else:
    win = int(0.05 * SR)
    env = np.sqrt(np.convolve(voice**2, np.ones(win) / win, mode="same"))
    env = np.convolve(env, np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
    env /= env.max() + 1e-9
    duck = 1 - 0.5 * np.clip(env * 3, 0, 1)
    v_rms = np.sqrt(np.mean(voice[np.abs(voice) > 0.01] ** 2))
    music_level, fx_level = 0.55, 1.1

music *= v_rms * music_level / (np.sqrt(np.mean(music**2)) + 1e-9) * duck
fx *= v_rms * fx_level / (np.sqrt(np.mean(fx[np.abs(fx) > 1e-4] ** 2)) + 1e-9)

mix = voice + music + fx
mix /= max(1.0, np.max(np.abs(mix)) / 0.95)

BRUT = OUT.with_name(OUT.stem + "_brut.wav")
with wave.open(str(BRUT), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())

subprocess.run(
    ["ffmpeg", "-v", "error", "-y", "-i", str(BRUT), "-af", "loudnorm=I=-14:TP=-1.2:LRA=9", "-ar", str(SR), str(OUT)],
    check=True,
)
print(f"{OUT.name} : {DUR:.1f} s, {len(T['sfx'])} bruitages")
