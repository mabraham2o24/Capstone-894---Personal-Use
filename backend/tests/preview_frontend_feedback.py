
"""
Preview Virtual Music Instructor feedback in the terminal.

Works with any supported MusicXML score and WAV recording.

Run from the backend directory.

Example:
python -m tests.preview_frontend_feedback \
    --score test_music/Minuet_in_F/minuet_in_f.mxl \
    --audio test_music/Minuet_in_F/performances/minuet_measures_1_4_piano_correct.wav \
    --start 1 --end 4
"""

import argparse
import json
from pathlib import Path

from music_analysis.score_parser import (
    extract_note_details,
    extract_rest_details,
)
from music_analysis.note_events import (
    detect_note_events,
    detect_silence_regions,
)
from music_analysis.performance_segmentation import segment_performance
from music_analysis.performance_analysis import analyze_performance
from music_analysis.feedback_formatter import format_note_feedback


def preview_performance(
    score_path,
    audio_path,
    start_measure=None,
    end_measure=None,
    part_index=0,
    output_path=None,
):
    score_path = Path(score_path)
    audio_path = Path(audio_path)

    if not score_path.is_file():
        raise FileNotFoundError(
            f"Score not found: {score_path}"
        )

    if not audio_path.is_file():
        raise FileNotFoundError(
            f"Recording not found: {audio_path}"
        )

    if score_path.suffix.lower() not in (
        ".xml", ".musicxml", ".mxl"
    ):
        raise ValueError("Score must be a MusicXML file.")

    if audio_path.suffix.lower() != ".wav":
        raise ValueError("Recording must be a WAV file.")

    if (start_measure is None) != (end_measure is None):
        raise ValueError(
            "Provide both --start and --end, or neither."
        )

    if (
        start_measure is not None
        and start_measure > end_measure
    ):
        raise ValueError(
            "Start measure cannot exceed end measure."
        )

    # Extract score notes and written rests.
    expected = extract_note_details(
        str(score_path),
        part_index=part_index,
    )

    rests = extract_rest_details(
        str(score_path),
        part_index=part_index,
    )

    # Restrict analysis to the selected measures.
    if start_measure is not None:
        expected = [
            note for note in expected
            if start_measure <= note["measure"] <= end_measure
        ]

        rests = [
            rest for rest in rests
            if start_measure <= rest["measure"] <= end_measure
        ]

    if not expected:
        raise ValueError(
            "No expected notes found in the selected score range."
        )

    # Detect notes and silence in the performance.
    raw_events = detect_note_events(str(audio_path))
    silence_regions = detect_silence_regions(str(audio_path))

    # Segment the performance against the score.
    segmentation = segment_performance(
        expected,
        raw_events,
    )

    performed = segmentation["performed_events"]

    performance_start = None

    if performed:
        first_event = performed[0]
        performance_start = first_event.get(
            "measured_onset"
        )

        if performance_start is None:
            performance_start = first_event["onset"]

    # Run the production performance analysis.
    analysis = analyze_performance(
        expected,
        performed,
        silence_regions=silence_regions,
        seconds_per_beat=segmentation["seconds_per_beat"],
        performance_start=performance_start,
        audio_path=str(audio_path),
        rest_details=rests,
    )

    # Format results for the frontend.
    feedback = format_note_feedback(
        expected,
        analysis,
    )

    accuracy = analysis["pitch_accuracy"]
    errors = analysis["errors"]

    print("\n" + "=" * 85)
    print("VIRTUAL MUSIC INSTRUCTOR — PERFORMANCE PREVIEW")
    print("=" * 85)

    print(f"Score: {score_path.name}")
    print(f"Audio: {audio_path.name}")
    print(f"Part index: {part_index}")

    if start_measure is not None:
        print(
            f"Measures: {start_measure}–{end_measure}"
        )
    else:
        print("Measures: Entire score")

    print(f"Expected notes: {len(expected)}")
    print(f"Raw detected events: {len(raw_events)}")
    print(f"Segmented events: {len(performed)}")

    print("\n" + "-" * 85)
    print("PERFORMANCE SUMMARY")
    print("-" * 85)

    print(
        f"Pitch accuracy: {accuracy['accuracy_percent']}% "
        f"({accuracy['correct_notes']}/"
        f"{accuracy['total_expected_notes']})"
    )

    sequence_accuracy = analysis["note_sequence_accuracy"]

    print(
        f"Note-sequence accuracy: "
        f"{sequence_accuracy['accuracy_percent']}% "
        f"({sequence_accuracy['correct_notes']}/"
        f"{sequence_accuracy['total_notes']})"
    )

    print(
        "Incorrect pitches:",
        len(errors["incorrect_pitch"]),
    )
    print(
        "Missing notes:",
        len(errors["missing_notes"]),
    )
    print(
        "Additional notes:",
        len(errors["additional_notes"]),
    )

    print("\n" + "-" * 85)
    print("FRONTEND NOTE FEEDBACK")
    print("-" * 85)

    for index, item in enumerate(feedback, start=1):
        measure = item.get("measure")
        beat = item.get("beat")

        expected_pitch = item.get("expected_note")
        played_pitch = item.get("played_note")

        pitch_status = item.get("pitch_status")

        print(
            f"\n{index:>2}. "
            f"Measure {measure}, Beat {beat}"
        )

        print(
            f"    Expected pitch: {expected_pitch}"
        )
        print(
            f"    Played pitch:   {played_pitch}"
        )
        print(
            f"    Pitch status:   {pitch_status}"
        )

        expected_length = item.get(
            "expected_note_length"
        )
        played_length = item.get(
            "played_note_length"
        )
        duration_status = item.get(
            "duration_status"
        )

        if expected_length is not None:
            print(
                f"    Expected length: {expected_length}"
            )

        if played_length is not None:
            print(
                f"    Played length:   {played_length}"
            )

        if duration_status is not None:
            print(
                f"    Duration status: {duration_status}"
            )

        timing_status = item.get("timing_status")

        if timing_status is not None:
            print(
                f"    Timing status:   {timing_status}"
            )

        missing_behavior = item.get(
            "missing_note_behavior"
        )

        if missing_behavior is not None:
            print(
                f"    Missing behavior: {missing_behavior}"
            )

        pause_duration = item.get(
            "missing_note_pause_duration"
        )

        if pause_duration is not None:
            print(
                f"    Pause duration: {pause_duration}s"
            )

    print("\n" + "=" * 85)
    print("END OF PERFORMANCE PREVIEW")
    print("=" * 85)

    # This mirrors the analysis-related fields of the
    # upload-audio API response.
    result = {
        "score": str(score_path),
        "audio": str(audio_path),
        "start_measure": start_measure,
        "end_measure": end_measure,
        "part_index": part_index,
        "performance_analysis": analysis,
        "note_feedback": feedback,
    }

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with output_path.open(
            "w", encoding="utf-8"
        ) as file:
            json.dump(
                result,
                file,
                indent=2,
                ensure_ascii=False,
            )

        print(f"\nJSON saved to: {output_path}")

    return result


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Preview VMI performance feedback for "
            "any MusicXML score and WAV recording."
        )
    )

    parser.add_argument(
        "--score",
        required=True,
        help="Path to the MusicXML score.",
    )

    parser.add_argument(
        "--audio",
        required=True,
        help="Path to the WAV recording.",
    )

    parser.add_argument(
        "--start",
        type=int,
        default=None,
        help="First measure to analyze.",
    )

    parser.add_argument(
        "--end",
        type=int,
        default=None,
        help="Last measure to analyze.",
    )

    parser.add_argument(
        "--part",
        type=int,
        default=0,
        help="Zero-based score part index (default: 0).",
    )

    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to save the results as JSON.",
    )

    args = parser.parse_args()

    preview_performance(
        score_path=args.score,
        audio_path=args.audio,
        start_measure=args.start,
        end_measure=args.end,
        part_index=args.part,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
