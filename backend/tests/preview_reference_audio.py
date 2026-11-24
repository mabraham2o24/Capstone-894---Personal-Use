"""
Manual validation of generated reference audio.

Generates reference WAV files for selected measures using
the MusicXML score and an existing performance recording.
"""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from music_analysis.score_parser import (
    extract_note_details,
    extract_rest_details,
    extract_tempo,
)
from music_analysis.note_events import detect_note_events
from music_analysis.performance_segmentation import (
    segment_performance,
)
from music_analysis.performance_analysis import (
    analyze_performance,
)
from music_analysis.reference_audio import (
    generate_reference_audio,
)


def preview_reference(
    score_path,
    performance_path,
    start_measure,
    end_measure,
    output_path,
):
    print("\n" + "=" * 60)
    print("Score:", score_path.name)
    print("Performance:", performance_path.name)
    print(f"Selected measures: {start_measure}-{end_measure}")

    score_summary = {
        "note_details": extract_note_details(score_path),
        "rest_details": extract_rest_details(score_path),
        "tempo_bpm": extract_tempo(score_path),
    }

    expected_events = [
        note
        for note in score_summary["note_details"]
        if start_measure <= note["measure"] <= end_measure
    ]

    rest_details = [
        rest
        for rest in score_summary["rest_details"]
        if start_measure <= rest["measure"] <= end_measure
    ]

    detected_events = detect_note_events(
        str(performance_path)
    )

    segmentation = segment_performance(
        expected_events,
        detected_events,
    )

    performed_events = segmentation["performed_events"]

    performance_analysis = analyze_performance(
        expected_events,
        performed_events,
        seconds_per_beat=segmentation["seconds_per_beat"],
        rest_details=rest_details,
    )

    result = generate_reference_audio(
        score_summary=score_summary,
        start_measure=start_measure,
        end_measure=end_measure,
        performance_analysis=performance_analysis,
    )

    output_path.write_bytes(result["audio_bytes"])

    timing = performance_analysis.get("timing") or {}
    seconds_per_beat = timing.get("seconds_per_beat")

    print("Total score notes:", len(score_summary["note_details"]))
    print("Selected score notes:", len(expected_events))
    print("Selected written rests:", len(rest_details))
    print("Score BPM:", score_summary["tempo_bpm"])

    if seconds_per_beat and seconds_per_beat > 0:
        print(
            "Estimated performance BPM:",
            round(60 / seconds_per_beat, 2),
        )

    print("Reference BPM:", result["tempo_bpm"])
    print("Tempo source:", result["tempo_source"])
    print("Duration:", result["duration_seconds"], "seconds")

    print("\nExpected note sequence:")

    for note in expected_events:
        print(
            f"Measure {note['measure']} | "
            f"Beat {note['beat']} | "
            f"{note['pitch']} | "
            f"Duration {note['duration']}"
        )

    print("\nSaved:", output_path)


if __name__ == "__main__":
    music_dir = BACKEND_DIR / "test_music"

    output_dir = BACKEND_DIR / "test_audio"
    output_dir.mkdir(exist_ok=True)

    canon_dir = music_dir / "Canon_in_D"

    preview_reference(
        score_path=canon_dir / "canon-in-d.mxl",
        performance_path=(
            canon_dir
            / "performances"
            / "canon_measures_3_6_correct.wav"
        ),
        start_measure=3,
        end_measure=6,
        output_path=(
            output_dir
            / "reference_canon_measures_3_6.wav"
        ),
    )

    minuet_dir = music_dir / "Minuet_in_F"

    preview_reference(
        score_path=minuet_dir / "minuet_in_f.mxl",
        performance_path=(
            minuet_dir
            / "performances"
            / "minuet_measures_1_4_violin_correct.wav"
        ),
        start_measure=1,
        end_measure=4,
        output_path=(
            output_dir
            / "reference_minuet_measures_1_4.wav"
        ),
    )