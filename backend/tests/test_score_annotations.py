"""Tests for stored score files, note locations, and sheet-music annotations."""

import zipfile

import pytest
from music21 import chord, meter, note, stream

from music_analysis.score_annotations import build_score_annotations
from music_analysis.score_files import read_musicxml_bytes
from music_analysis.score_parser import extract_note_details


CANON_MXL = "test_music/Canon_in_D/canon-in-d.mxl"
SAMPLE_MUSICXML = "../public/sample.musicxml"


# Score files

def test_plain_musicxml_is_returned_unchanged():
    with open(SAMPLE_MUSICXML, "rb") as file:
        original = file.read()

    assert read_musicxml_bytes(SAMPLE_MUSICXML) == original


def test_compressed_mxl_is_returned_as_plain_musicxml(tmp_path):
    musicxml = read_musicxml_bytes(CANON_MXL)

    assert musicxml.startswith(b"<?xml")

    # The unpacked score has the same notes as the original upload.
    unpacked = tmp_path / "canon.musicxml"
    unpacked.write_bytes(musicxml)

    assert extract_note_details(str(unpacked)) == extract_note_details(CANON_MXL)


def test_mxl_without_container_uses_first_musicxml_file(tmp_path):
    archive_path = tmp_path / "score.mxl"

    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("score.xml", "<score-partwise/>")

    assert read_musicxml_bytes(archive_path) == b"<score-partwise/>"


def test_invalid_mxl_is_rejected(tmp_path):
    bad_file = tmp_path / "broken.mxl"
    bad_file.write_bytes(b"not a zip file")

    with pytest.raises(ValueError):
        read_musicxml_bytes(bad_file)


def test_mxl_without_a_score_is_rejected(tmp_path):
    archive_path = tmp_path / "empty.mxl"

    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("readme.txt", "no score here")

    with pytest.raises(ValueError):
        read_musicxml_bytes(archive_path)


# Note locations

def test_note_details_include_location_fields():
    notes = extract_note_details(CANON_MXL)

    a4 = next(
        note for note in notes
        if note["measure"] == 4 and note["beat"] == 2.0
    )

    assert a4["part_index"] == 0
    assert a4["offset_in_measure"] == 1.0
    assert a4["midi"] == 69
    assert a4["note_id"] == "p0_m4_q1.0_A4"


def test_note_ids_are_unique():
    for path in [CANON_MXL, "test_music/Minuet_in_F/minuet_in_f.mxl"]:
        note_ids = [note["note_id"] for note in extract_note_details(path)]

        assert len(note_ids) == len(set(note_ids))


@pytest.fixture
def compound_meter_score(tmp_path):
    """A 6/8 score with a pickup measure, two voices, and a chord."""
    part = stream.Part()

    pickup = stream.Measure(number=0)
    pickup.append(meter.TimeSignature("6/8"))
    pickup.append(note.Note("D5", quarterLength=0.5))
    pickup.padAsAnacrusis()

    measure = stream.Measure(number=1)
    upper = stream.Voice(id="1")
    lower = stream.Voice(id="2")

    for pitch in ["G5", "A5", "B5", "G5", "A5", "B5"]:
        upper.append(note.Note(pitch, quarterLength=0.5))

    lower.append(note.Note("G4", quarterLength=1.5))
    lower.append(chord.Chord(["B3", "D4"], quarterLength=1.5))

    measure.insert(0, upper)
    measure.insert(0, lower)

    part.append(pickup)
    part.append(measure)

    score = stream.Score()
    score.insert(0, part)

    return str(score.write("musicxml", fp=tmp_path / "compound.musicxml"))


def test_offset_in_measure_is_in_quarter_notes(compound_meter_score):
    notes = extract_note_details(compound_meter_score)

    second_eighth = next(
        note for note in notes
        if note["measure"] == 1 and note["pitch"] == "A5"
    )

    # In 6/8, music21's beat counts dotted quarters, so the second
    # eighth note is beat 1.33. Its position in quarter notes is 0.5.
    assert second_eighth["beat"] != second_eighth["offset_in_measure"] + 1
    assert second_eighth["offset_in_measure"] == 0.5


def test_pickup_measure_keeps_its_measure_number(compound_meter_score):
    notes = extract_note_details(compound_meter_score)

    assert notes[0]["measure"] == 0
    assert notes[0]["note_id"] == "p0_m0_q0.0_D5"


def test_notes_in_different_voices_get_distinct_ids(compound_meter_score):
    notes = extract_note_details(compound_meter_score)

    starting_together = [
        note for note in notes
        if note["measure"] == 1 and note["offset_in_measure"] == 0.0
    ]

    assert {note["pitch"] for note in starting_together} == {"G5", "G4"}
    assert len({note["note_id"] for note in starting_together}) == 2


def test_repeated_location_gets_a_suffix(tmp_path):
    part = stream.Part()
    measure = stream.Measure(number=1)

    for voice_id in ["1", "2"]:
        voice = stream.Voice(id=voice_id)
        voice.append(note.Note("C5", quarterLength=1.0))
        measure.insert(0, voice)

    part.append(measure)

    path = part.write("musicxml", fp=tmp_path / "unison.musicxml")
    note_ids = [note["note_id"] for note in extract_note_details(str(path))]

    assert note_ids == ["p0_m1_q0.0_C5", "p0_m1_q0.0_C5-2"]


# Annotations

def feedback_item(**overrides):
    item = {
        "measure": 4,
        "beat": 2.0,
        "expected_note": "A4",
        "played_note": "A4",
        "pitch_status": "correct",
        "expected_note_length": "quarter note",
        "played_note_length": "quarter note",
        "duration_status": "correct",
        "timing_status": "on_time",
        "note_id": "p0_m4_q1.0_A4",
        "part_index": 0,
        "offset_in_measure": 1.0,
        "midi": 69,
    }
    item.update(overrides)
    return item


def errors_of(annotations):
    return [
        error["type"]
        for annotated_note in annotations["notes"]
        for error in annotated_note["errors"]
    ]


def test_correct_notes_are_not_annotated():
    annotations = build_score_annotations([feedback_item()])

    assert annotations == {"notes": [], "additional_notes": []}


def test_annotation_carries_note_location():
    annotations = build_score_annotations([
        feedback_item(timing_status="late"),
    ])

    annotated = annotations["notes"][0]

    assert annotated["note_id"] == "p0_m4_q1.0_A4"
    assert annotated["part_index"] == 0
    assert annotated["measure"] == 4
    assert annotated["offset_in_measure"] == 1.0
    assert annotated["midi"] == 69
    assert annotated["errors"] == [{
        "type": "late",
        "category": "timing",
        "description": "Played late.",
    }]


def test_incorrect_pitch_annotation():
    annotations = build_score_annotations([
        feedback_item(pitch_status="incorrect", played_note="B4"),
    ])

    error = annotations["notes"][0]["errors"][0]

    assert error["type"] == "incorrect_pitch"
    assert error["category"] == "pitch"
    assert error["description"] == "Played B4 instead of A4."


@pytest.mark.parametrize(
    "status,expected_type",
    [("early", "early"), ("late", "late")],
)
def test_timing_annotations(status, expected_type):
    annotations = build_score_annotations([
        feedback_item(timing_status=status),
    ])

    assert errors_of(annotations) == [expected_type]


def test_duration_annotation_names_both_lengths():
    annotations = build_score_annotations([
        feedback_item(
            duration_status="too_short",
            played_note_length="eighth note",
        ),
    ])

    error = annotations["notes"][0]["errors"][0]

    assert error["type"] == "too_short"
    assert error["category"] == "duration"
    assert error["description"] == (
        "Held too short: expected a quarter note, "
        "played about an eighth note."
    )


def test_duration_annotation_when_lengths_have_the_same_name():
    annotations = build_score_annotations([
        feedback_item(duration_status="too_long"),
    ])

    assert annotations["notes"][0]["errors"][0]["description"] == (
        "Held too long for a quarter note."
    )


@pytest.mark.parametrize(
    "behavior,phrase",
    [
        ("paused", "there was a pause in its place"),
        ("continued", "continued to the next note without a pause"),
        ("unknown", "This note was not played."),
    ],
)
def test_missing_note_annotation(behavior, phrase):
    annotations = build_score_annotations([
        feedback_item(
            pitch_status="missing",
            played_note=None,
            played_note_length=None,
            duration_status=None,
            timing_status=None,
            missing_note_behavior=behavior,
        ),
    ])

    error = annotations["notes"][0]["errors"][0]

    assert error["type"] == "missing_note"
    assert error["category"] == "missing"
    assert phrase in error["description"]


def test_multiple_errors_on_one_note_are_all_listed():
    annotations = build_score_annotations([
        feedback_item(
            pitch_status="incorrect",
            played_note="B4",
            timing_status="late",
            duration_status="too_long",
            played_note_length="half note",
        ),
    ])

    assert len(annotations["notes"]) == 1
    assert errors_of(annotations) == [
        "incorrect_pitch",
        "late",
        "too_long",
    ]


def test_additional_notes_are_listed_separately():
    annotations = build_score_annotations([
        {
            "measure": 3,
            "beat": 1.32,
            "expected_note": None,
            "played_note": "D5",
            "pitch_status": "additional",
        },
    ])

    assert annotations["notes"] == []
    assert annotations["additional_notes"] == [{
        "measure": 3,
        "beat": 1.32,
        "played_note": "D5",
        "description": "An extra D5 was played that is not in the score.",
    }]


def test_feedback_without_note_id_is_skipped():
    item = feedback_item(timing_status="late")
    del item["note_id"]

    assert build_score_annotations([item])["notes"] == []


def test_empty_feedback():
    assert build_score_annotations(None) == {
        "notes": [],
        "additional_notes": [],
    }
