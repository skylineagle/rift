import argparse
import wave

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 15
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
BASS = [45, 41, 36, 43]


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def at(bar, beat=1, fraction=0.0):
    return (bar - 1) * BAR + (beat - 1 + fraction) * BEAT


def place(track, start, sound, gain=1.0):
    begin = int(start * SR)
    end = min(len(track), begin + len(sound))
    if end > begin:
        track[begin:end] += sound[: end - begin] * gain


def kick():
    t = np.arange(int(0.35 * SR)) / SR
    pitch = 48 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t * 9)


def hat(rng, length=0.05):
    t = np.arange(int(length * SR)) / SR
    noise = rng.standard_normal(len(t))
    bright = np.diff(noise, prepend=0)
    return bright * np.exp(-t * 70) * 0.25


def clap(rng):
    t = np.arange(int(0.18 * SR)) / SR
    noise = rng.standard_normal(len(t))
    band = noise - np.roll(noise, 3)
    return band * np.exp(-t * 22) * 0.22


def bass_note(note, length):
    t = np.arange(int(length * SR)) / SR
    f = hz(note)
    wave_ = np.sin(2 * np.pi * f * t) + 0.35 * np.sign(np.sin(2 * np.pi * f * t)) * 0.4
    env = np.minimum(1, t / 0.005) * np.exp(-t * 5)
    return wave_ * env * 0.4


def pad_chord(notes, length):
    t = np.arange(int(length * SR)) / SR
    tone = np.zeros_like(t)
    for note in notes:
        for detune in (-0.08, 0.08):
            f = hz(note + 12) * (1 + detune / 100)
            tone += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    attack = np.minimum(1, t / 0.25)
    release = np.minimum(1, (length - t) / 0.3)
    return tone * attack * release * 0.045


def ping(note):
    t = np.arange(int(0.6 * SR)) / SR
    return np.sin(2 * np.pi * hz(note) * t) * np.exp(-t * 7) * 0.18


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--drums", required=True)
    args = parser.parse_args()
    rng = np.random.default_rng(7)
    total = BARS * BAR
    mix = np.zeros(int(total * SR))
    drums = np.zeros(int(total * SR))
    final_bar = 14

    for bar in range(1, final_bar):
        chord = (bar - 1) % 4
        place(mix, at(bar), pad_chord(CHORDS[chord], BAR), 1.0)
        for eighth in range(8):
            accent = 0.35 if eighth % 2 else 0.2
            if bar >= 2 or eighth % 2:
                place(mix, at(bar, 1, eighth * 0.5), hat(rng), accent)
        if bar >= 3:
            for beat in range(1, 5):
                place(mix, at(bar, beat), kick(), 0.9)
                place(drums, at(bar, beat), kick(), 0.9)
            for beat in (2, 4):
                place(mix, at(bar, beat), clap(rng), 1.0)
                place(drums, at(bar, beat), kick(), 0.5)
            for eighth in range(8):
                note = BASS[chord] + (12 if eighth % 2 else 0)
                place(mix, at(bar, 1, eighth * 0.5), bass_note(note, BEAT * 0.48), 1.0)
        elif bar == 2:
            place(mix, at(bar, 1), kick(), 0.6)
            place(mix, at(bar, 3), kick(), 0.6)

    place(mix, at(10, 3), ping(84), 1.0)
    place(mix, at(final_bar), kick(), 1.0)
    place(mix, at(final_bar), hat(rng, 0.9), 1.2)
    ring = pad_chord([57, 60, 64, 69], at(final_bar + 1, 3) - at(final_bar))
    place(mix, at(final_bar), ring, 1.4)
    place(mix, at(final_bar), bass_note(33, 1.6), 1.2)

    place(drums, at(final_bar), kick(), 1.0)
    write(args.drums, drums * 0.8)
    mix = np.tanh(mix * 1.4) * 0.8
    mix[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    write(args.out, mix)


def write(path, mix):
    stereo = np.stack([mix, mix], axis=1)
    pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main()
