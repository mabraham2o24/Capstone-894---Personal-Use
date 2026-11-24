"""
Score timing and duration feedback against known intended errors.

Runs the production pipeline on every recording listed in
test_music/ground_truth.json and compares the frontend note feedback
with the intended errors. Use it to judge a timing/duration change by
its effect across all recordings rather than one test at a time.

Run from the backend directory.

Examples:
python -m tests.timing_scoreboard
python -m tests.timing_scoreboard --details
python -m tests.timing_scoreboard --save scoreboard_before.json
python -m tests.timing_scoreboard --compare scoreboard_before.json
python -m tests.timing_scoreboard --only violin
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


GROUND_TRUTH_PATH = "test_music/ground_truth.json"

# Feedback field and "no error" value for each scored dimension.
DIMENSIONS = {
    "timing": ("timing_status", "on_time"),
    "duration": ("duration_status", "correct"),
}

# Outcomes of comparing one note's feedback with the ground truth.
CAUGHT = "caught"            # intended error reported correctly
MISSED = "missed"            # intended error not reported
FALSE_FLAG = "false_flag"    # error reported on a correct note
OK = "ok"                    # correct note reported as correct
UNCHECKED = "unchecked"      # correct note with no status reported


def load_score(score_info):
    """Return expected notes and rests restricted to the measure range."""
    start = score_info["start_measure"]
    end = score_info["end_measure"]

    expected = [
        note for note in extract_note_details(score_info["path"])
        if start <= note["measure"] <= end
    ]

    rests = [
        rest for rest in extract_rest_details(score_info["path"])
        if start <= rest["measure"] <= end
    ]

    return expected, rests


def run_pipeline(expected, rests, audio_path):
    """Run the same analysis steps as the upload-audio endpoint."""
    raw_events = detect_note_events(audio_path)
    silence_regions = detect_silence_regions(audio_path)

    segmentation = segment_performance(expected, raw_events)
    performed = segmentation["performed_events"]

    if not performed:
        return []

    first_event = performed[0]
    performance_start = first_event.get("measured_onset")

    if performance_start is None:
        performance_start = first_event["onset"]

    analysis = analyze_performance(
        expected,
        performed,
        silence_regions=silence_regions,
        seconds_per_beat=segmentation["seconds_per_beat"],
        performance_start=performance_start,
        audio_path=audio_path,
        rest_details=rests,
    )

    return format_note_feedback(expected, analysis)


def note_key(measure, beat):
    return (int(measure), float(beat))


def classify(expected_status, actual_status, ok_value):
    """Compare one note's reported status with its intended status."""
    if expected_status is not None:
        if actual_status == expected_status:
            return CAUGHT
        return MISSED

    if actual_status is None:
        return UNCHECKED

    if actual_status == ok_value:
        return OK

    return FALSE_FLAG


def score_recording(recording, expected, feedback):
    """Return per-note outcomes for each dimension of one recording."""
    feedback_by_key = {}

    for item in feedback:
        # Additional notes have no expected note to score.
        if item.get("expected_note") is None:
            continue

        feedback_by_key[
            note_key(item["measure"], item["beat"])
        ] = item

    ignored = {dimension: set() for dimension in DIMENSIONS}

    for entry in recording.get("ignore", []):
        for dimension in entry.get("check", list(DIMENSIONS)):
            ignored[dimension].add(
                note_key(entry["measure"], entry["beat"])
            )

    results = {}

    for dimension, (field, ok_value) in DIMENSIONS.items():
        intended = {
            note_key(entry["measure"], entry["beat"]): entry["expected"]
            for entry in recording.get(dimension, [])
        }

        notes = []

        for note in expected:
            key = note_key(note["measure"], note["beat"])

            if key in ignored[dimension]:
                continue

            item = feedback_by_key.get(key, {})
            expected_status = intended.get(key)
            actual_status = item.get(field)

            notes.append({
                "measure": note["measure"],
                "beat": note["beat"],
                "pitch": note["pitch"],
                "expected": expected_status or ok_value,
                "actual": actual_status,
                "outcome": classify(
                    expected_status,
                    actual_status,
                    ok_value,
                ),
            })

        results[dimension] = notes

    return results


def count_outcomes(notes):
    counts = {
        outcome: 0
        for outcome in (CAUGHT, MISSED, FALSE_FLAG, OK, UNCHECKED)
    }

    for note in notes:
        counts[note["outcome"]] += 1

    return counts


def print_table(scored, verified):
    """Print one line per recording plus totals for the group."""
    group = [
        entry for entry in scored
        if entry["verified"] == verified
    ]

    if not group:
        return

    title = (
        "VERIFIED RECORDINGS"
        if verified
        else "UNVERIFIED RECORDINGS (best-guess ground truth)"
    )

    print("\n" + "-" * 85)
    print(title)
    print("-" * 85)
    print(
        f"{'recording':<44}"
        f"{'timing':>20}"
        f"{'duration':>20}"
    )
    print(
        f"{'':<44}"
        f"{'caught  false':>20}"
        f"{'caught  false':>20}"
    )

    totals = {
        dimension: count_outcomes([])
        for dimension in DIMENSIONS
    }

    for entry in group:
        cells = []

        for dimension in DIMENSIONS:
            counts = count_outcomes(entry["results"][dimension])

            for outcome, value in counts.items():
                totals[dimension][outcome] += value

            intended = counts[CAUGHT] + counts[MISSED]
            cells.append(
                f"{counts[CAUGHT]}/{intended}  "
                f"{counts[FALSE_FLAG]:>5}"
            )

        print(
            f"{entry['name']:<44}"
            f"{cells[0]:>20}"
            f"{cells[1]:>20}"
        )

    print()

    for dimension in DIMENSIONS:
        counts = totals[dimension]
        intended = counts[CAUGHT] + counts[MISSED]
        correct_notes = (
            counts[FALSE_FLAG] + counts[OK] + counts[UNCHECKED]
        )

        print(
            f"{dimension.capitalize():<9} "
            f"caught {counts[CAUGHT]}/{intended} intended errors, "
            f"{counts[FALSE_FLAG]} false flags on "
            f"{correct_notes} correct notes "
            f"({counts[UNCHECKED]} not evaluated)"
        )


def print_details(scored):
    """List every missed error and false flag."""
    print("\n" + "-" * 85)
    print("DETAILS: missed errors and false flags")
    print("-" * 85)

    for entry in scored:
        lines = []

        for dimension in DIMENSIONS:
            for note in entry["results"][dimension]:
                if note["outcome"] not in (MISSED, FALSE_FLAG):
                    continue

                lines.append(
                    f"    {note['outcome']:<10} {dimension:<8} "
                    f"m{note['measure']} b{note['beat']} "
                    f"{note['pitch']:<4} "
                    f"expected {note['expected']}, "
                    f"got {note['actual']}"
                )

        if lines:
            print(f"\n{entry['name']}")
            print("\n".join(lines))


def print_comparison(scored, previous_path):
    """Show which notes changed outcome since a saved run."""
    with Path(previous_path).open(encoding="utf-8") as file:
        previous = {
            entry["name"]: entry
            for entry in json.load(file)["recordings"]
        }

    better = []
    worse = []
    good = (CAUGHT, OK)

    for entry in scored:
        old_entry = previous.get(entry["name"])

        if old_entry is None:
            continue

        for dimension in DIMENSIONS:
            old_notes = {
                note_key(note["measure"], note["beat"]): note
                for note in old_entry["results"][dimension]
            }

            for note in entry["results"][dimension]:
                old = old_notes.get(
                    note_key(note["measure"], note["beat"])
                )

                if old is None or old["outcome"] == note["outcome"]:
                    continue

                line = (
                    f"    {entry['name']:<44} {dimension:<8} "
                    f"m{note['measure']} b{note['beat']} "
                    f"{note['pitch']:<4} "
                    f"{old['outcome']} -> {note['outcome']}"
                )

                if note["outcome"] in good and old["outcome"] not in good:
                    better.append(line)
                elif old["outcome"] in good and note["outcome"] not in good:
                    worse.append(line)

    print("\n" + "-" * 85)
    print(f"CHANGES SINCE {previous_path}")
    print("-" * 85)
    print(f"Improved notes: {len(better)}")
    print("\n".join(better))
    print(f"Regressed notes: {len(worse)}")
    print("\n".join(worse))


def run_scoreboard(
    only=None,
    details=False,
    save_path=None,
    compare_path=None,
):
    with Path(GROUND_TRUTH_PATH).open(encoding="utf-8") as file:
        ground_truth = json.load(file)

    scores = {
        name: load_score(info)
        for name, info in ground_truth["scores"].items()
    }

    scored = []

    for recording in ground_truth["recordings"]:
        name = Path(recording["file"]).stem

        if only is not None and only not in name:
            continue

        print(f"Analyzing {name}...", flush=True)

        expected, rests = scores[recording["score"]]
        feedback = run_pipeline(expected, rests, recording["file"])

        scored.append({
            "name": name,
            "verified": recording.get("verified", False),
            "results": score_recording(recording, expected, feedback),
        })

    print("\n" + "=" * 85)
    print("TIMING / DURATION SCOREBOARD")
    print("=" * 85)
    print(
        "caught = intended errors reported / intended errors; "
        "false = flags on correct notes"
    )

    print_table(scored, verified=True)
    print_table(scored, verified=False)

    if details:
        print_details(scored)

    if compare_path is not None:
        print_comparison(scored, compare_path)

    if save_path is not None:
        with Path(save_path).open("w", encoding="utf-8") as file:
            json.dump({"recordings": scored}, file, indent=2)

        print(f"\nResults saved to: {save_path}")

    return scored


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Score timing and duration feedback against the "
            "intended errors in test_music/ground_truth.json."
        )
    )

    parser.add_argument(
        "--only",
        default=None,
        help="Only run recordings whose name contains this text.",
    )

    parser.add_argument(
        "--details",
        action="store_true",
        help="List every missed error and false flag.",
    )

    parser.add_argument(
        "--save",
        default=None,
        help="Save per-note results as JSON for a later --compare.",
    )

    parser.add_argument(
        "--compare",
        default=None,
        help="Show notes that improved or regressed since a saved run.",
    )

    args = parser.parse_args()

    run_scoreboard(
        only=args.only,
        details=args.details,
        save_path=args.save,
        compare_path=args.compare,
    )


if __name__ == "__main__":
    main()
