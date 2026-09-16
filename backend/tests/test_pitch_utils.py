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