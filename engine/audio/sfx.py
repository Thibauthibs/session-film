"""Bruitages synthétisés en local (gratuits, libres de droits). Chaque fonction rend un tableau numpy à 48 kHz."""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(11)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def lowpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def ding():
    """Notification iOS : deux notes claires et brèves."""
    out = np.zeros(int(0.9 * SR))
    for at, f0 in ((0.0, 1318.5), (0.09, 1975.5)):
        t = t_axis(0.8)
        tone = np.sin(2 * np.pi * f0 * t) + 0.3 * np.sin(2 * np.pi * f0 * 2.01 * t) + 0.1 * np.sin(2 * np.pi * f0 * 3 * t)
        env = np.minimum(1, t / 0.004) * np.exp(-t * 7)
        i = int(at * SR)
        out[i : i + len(t)] += tone * env * 0.5
    return out


def pop():
    """Bulle de message qui arrive : petit « bloup » montant."""
    t = t_axis(0.18)
    f = 380 + 900 * (t / t[-1]) ** 0.6
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.003) * np.exp(-t * 28)
    return np.sin(ph) * env * 0.9


def send():
    """Message envoyé : glissé court vers l'aigu."""
    t = t_axis(0.22)
    f = 700 + 1400 * (t / t[-1])
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.sin(np.pi * t / t[-1]) ** 2
    return np.sin(ph) * env * 0.35


def whoosh(sec=0.45, up=True):
    """Souffle filtré qui balaie, pour les transitions."""
    n = int(sec * SR)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, z = k * n // steps, (k + 1) * n // steps
        p = k / (steps - 1)
        fc = 400 + 5000 * (p if up else 1 - p)
        out[a:z] = bandpass(noise, max(80, fc * 0.5), min(20000, fc * 1.6))[a:z]
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return out * env * 0.35


def click():
    """Clic d'interface sec."""
    t = t_axis(0.05)
    body = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 180)
    tick = highpass(rng.normal(0, 1, len(t)), 3000) * np.exp(-t * 400) * 0.4
    return (body + tick) * 0.6


def key():
    """Touche de clavier."""
    t = t_axis(0.04)
    return highpass(rng.normal(0, 1, len(t)), 1800) * np.exp(-t * 220) * 0.25


def tick():
    """Petit tic de compteur."""
    t = t_axis(0.025)
    return np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 300) * 0.25


def check():
    """Case cochée : clic + note brève."""
    t = t_axis(0.25)
    note = np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 18) * 0.3
    out = note.copy()
    c = click()
    out[: len(c)] += c
    return out


def stamp():
    """Tampon qui s'écrase : choc grave + claquement."""
    t = t_axis(0.6)
    thump = np.sin(2 * np.pi * (55 + 120 * np.exp(-t * 25)) * t) * np.exp(-t * 9)
    slap = lowpass(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 45) * 0.8
    return (thump + slap) * 0.8


def boom():
    """Impact grave pour le logo."""
    t = t_axis(2.2)
    sub = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 5)) * t) * np.exp(-t * 2.2)
    air = lowpass(rng.normal(0, 1, len(t)), 900) * np.exp(-t * 6) * 0.35
    return (sub + air) * 0.9


def riser(sec=1.4):
    """Montée avant un moment fort."""
    n = int(sec * SR)
    p = np.linspace(0, 1, n)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    steps = 30
    for k in range(steps):
        a, z = k * n // steps, (k + 1) * n // steps
        fc = 300 + 7000 * (k / steps) ** 2
        out[a:z] = bandpass(noise, fc * 0.6, min(20000, fc * 1.5))[a:z]
    tone = np.sin(2 * np.pi * np.cumsum(200 + 600 * p**2) / SR) * 0.15
    return (out * 0.3 + tone) * p**2


BANK = {
    "ding": ding,
    "pop": pop,
    "send": send,
    "whoosh": whoosh,
    "whoosh_down": lambda: whoosh(0.4, up=False),
    "click": click,
    "key": key,
    "tick": tick,
    "check": check,
    "stamp": stamp,
    "boom": boom,
    "riser": riser,
}
