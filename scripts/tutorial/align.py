#!/usr/bin/env python3
"""Forced alignment of the narration: when each word of a clip's known text is spoken.

    ~/.venvs/whisperx/bin/python scripts/tutorial/align.py in.json out.json

in.json is [{"audio": "<mp3>", "sentences": ["…", …]}, …]; out.json is, per clip, {"times": [start of each
sentence], "words": [[word, start], …]}. Called by audio.mjs (Voicebox renders and --realign); it needs WhisperX
in its own venv (`python3 -m venv ~/.venvs/whisperx && ~/.venvs/whisperx/bin/pip install whisperx`).

Only WhisperX's alignment model (wav2vec2) runs, never its transcription: the text is the script's, so a word the
transcriber would mishear ("Xango" as "Zango") is still placed. The model knows only letters and apostrophes, so
each word is aligned in a spoken form ("50" as "fifty", "π" as "pi"); a word with none (a dash) takes the time of
the word after it.
"""
import json
import os
import re
import sys
import unicodedata

import certifi

# python.org's Python has no root certificates, so the model's first download fails without these
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

import whisperx  # noqa: E402

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
SPECIAL = {"π": "pi", "&": "and", "%": "percent", "+": "plus"}


def number(n):
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + number(n % 100))
    return number(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + number(n % 1000))


def spoken_form(word):
    """The letters the model will hear for one word of the text, or "" if it has none."""
    for k, v in SPECIAL.items():
        word = word.replace(k, f" {v} ")
    word = re.sub(r"\d+", lambda m: f" {number(int(m.group()))} ", word)
    word = unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z' ]", " ", word).split())


def align_clip(model, metadata, clip):
    audio = whisperx.load_audio(clip["audio"])
    duration = len(audio) / 16000
    # Each word of the text, with the sentence it belongs to and its spoken form (which may be several words)
    words = []
    for s, sentence in enumerate(clip["sentences"]):
        for w in sentence.split():
            words.append({"sentence": s, "text": w, "form": spoken_form(w).split()})
    forms = [f for w in words for f in w["form"]]
    if not forms:
        return {"times": [0] * len(clip["sentences"]), "words": []}
    result = whisperx.align([{"start": 0, "end": duration, "text": " ".join(forms)}], model, metadata, audio, "cpu")
    starts = [seg.get("start") for seg in result["word_segments"]]
    if len(starts) != len(forms):
        raise RuntimeError(f"{clip['audio']}: aligned {len(starts)} words, expected {len(forms)}")
    # A text word starts with its first spoken form; one with none, or the model could not place, takes the next
    i = 0
    for w in words:
        w["start"] = next((t for t in starts[i:i + len(w["form"])] if t is not None), None)
        i += len(w["form"])
    nxt = duration
    for w in reversed(words):
        if w["start"] is None:
            w["start"] = nxt
        nxt = w["start"]
    times = []
    for s in range(len(clip["sentences"])):
        first = next((w["start"] for w in words if w["sentence"] == s), None)
        times.append(first)
    # An empty sentence (an image only) starts where the next one does
    nxt = round(duration, 3)
    for s in reversed(range(len(times))):
        if times[s] is None:
            times[s] = nxt
        nxt = times[s]
    # Start a hair early, so the highlight lands with the word rather than just after it
    times = [0] + [round(max(0, t - 0.05), 3) for t in times[1:]]
    clean = lambda t: re.sub(r"[^\w'’-]", "", t)
    return {"times": times, "words": [[clean(w["text"]), round(w["start"], 3)] for w in words if clean(w["text"])]}


def main():
    src, dst = sys.argv[1:3]
    clips = json.load(open(src))
    model, metadata = whisperx.load_align_model(language_code="en", device="cpu")
    out = []
    for clip in clips:
        try:
            out.append(align_clip(model, metadata, clip))
        except Exception as e:  # one bad clip should not lose the batch; audio.mjs keeps its old timings
            out.append({"error": str(e)})
    json.dump(out, open(dst, "w"))


if __name__ == "__main__":
    main()
