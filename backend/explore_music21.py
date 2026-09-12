"""
Standalone music21 exploration script - Week 1, Sprint 1.

Run this directly (no server needed) to see how music21 loads a
MusicXML file and what basic information we can pull out of it:
notes, pitches, durations, measures, and tempo.

This is separate from main.py on purpose: main.py wires the parsing
into the API, this script is just for learning/documenting how
music21 works. Good to keep around and paste output/screenshots into
the Week 3 report as evidence of the "research and learning" spike work.

Usage:
    python explore_music21.py sample.xml
"""

import sys

from music21 import converter, tempo


def explore(path: str) -> None:
    print(f"Loading: {path}")
    score = converter.parse(path)

    print("\n--- Basic score info ---")
    print(f"Title: {score.metadata.title if score.metadata else 'Unknown'}")
    print(f"Number of parts: {len(score.parts)}")

    flat = score.flatten()
    notes = flat.notes
    print(f"Total notes/chords found: {len(notes)}")

    print("\n--- First 10 notes (pitch, duration in quarter lengths, offset) ---")
    for n in notes[:10]:
        if n.isChord:
            pitch_str = "+".join(p.nameWithOctave for p in n.pitches)
        else:
            pitch_str = n.pitch.nameWithOctave
        print(f"  {pitch_str:>10}  dur={n.duration.quarterLength:<5}  offset={n.offset}")

    print("\n--- Measures ---")
    if score.parts:
        measures = score.parts[0].getElementsByClass("Measure")
        print(f"Measure count (part 1): {len(measures)}")

    print("\n--- Tempo ---")
    tempo_marks = score.recurse().getElementsByClass(tempo.MetronomeMark)
    if len(tempo_marks) > 0:
        print(f"Found tempo marking: {tempo_marks[0].number} BPM")
    else:
        print("No explicit tempo marking found in this file.")


if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else "sample.xml"
    explore(file_path)
