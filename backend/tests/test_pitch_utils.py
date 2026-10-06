import pytest

from music_analysis.pitch_utils import note_to_midi, pitch_distance


def test_note_to_midi():
    assert note_to_midi("C4") == 60
    assert note_to_midi("D4") == 62
    assert note_to_midi("E4") == 64
    assert note_to_midi("F4") == 65
    assert note_to_midi("G4") == 67


def test_sharp_note_to_midi():
    assert note_to_midi("C#4") == 61
    assert note_to_midi("F#4") == 66


def test_same_pitch_distance():
    assert pitch_distance("C4", "C4") == 0


def test_one_semitone_pitch_distance():
    assert pitch_distance("E4", "F4") == 1


def test_multiple_semitone_pitch_distance():
    assert pitch_distance("E4", "G4") == 3


def test_octave_pitch_distance():
    assert pitch_distance("E4", "E5") == 12

def test_invalid_note_raises_error():
    with pytest.raises(ValueError):
        note_to_midi("H4")

def test_flat_note_to_midi():
    """music21 represents flats using '-'."""
    assert note_to_midi("D-4") == 61
    assert note_to_midi("E-4") == 63
    assert note_to_midi("G-4") == 66
    assert note_to_midi("A-4") == 68
    assert note_to_midi("B-4") == 70


def test_enharmonic_pitch_distance():
    """Enharmonic sharp/flat spellings should represent the same pitch."""
    assert pitch_distance("C#4", "D-4") == 0
    assert pitch_distance("D#4", "E-4") == 0
    assert pitch_distance("F#4", "G-4") == 0
    assert pitch_distance("G#4", "A-4") == 0
    assert pitch_distance("A#4", "B-4") == 0


def test_enharmonic_pitches_across_octaves():
    """Enharmonic handling should not be limited to octave 4."""
    assert pitch_distance("C#3", "D-3") == 0
    assert pitch_distance("F#5", "G-5") == 0
    assert pitch_distance("A#6", "B-6") == 0