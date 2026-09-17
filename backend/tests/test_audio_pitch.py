from pathlib import Path

from music_analysis.audio_pitch import detect_pitches


def test_detect_c_major_scale():
    audio_file = (
        Path(__file__).parent
        / "fixtures"
        / "c_major_test.wav"
    )

    detected_pitches = detect_pitches(str(audio_file))

    assert detected_pitches == [
        "C4",
        "D4",
        "E4",
        "F4",
        "G4",
        "A4",
        "B4",
        "C5",
    ]