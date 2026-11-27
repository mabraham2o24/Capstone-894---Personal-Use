# Annotated Sheet Music: Backend API

This guide is for connecting `src/components/AnnotatedSheetMusic.jsx` to real data, replacing `public/sample_long.musicxml` and `MOCK_ERRORS`.

The backend provides two things:

1. **The uploaded score** for a practice session, as plain MusicXML.
2. **Annotations**: the score notes that had errors, each with the fields needed to find that exact note in OpenSheetMusicDisplay (OSMD).

Both endpoints require a login. Call them with `authFetch` from `src/auth.js`, which adds the login token.

## 1. Get the score

```
GET /sessions/{session_id}/score
```

Returns the uploaded score as plain MusicXML text (`application/vnd.recordare.musicxml+xml`). Compressed `.mxl` uploads are returned uncompressed, so the response can go straight into `osmd.load()`.

```js
const response = await authFetch(`/sessions/${sessionId}/score`)

if (response.ok) {
  setMusicXML(await response.text())
}
```

| Status | Meaning |
| --- | --- |
| 200 | MusicXML text |
| 401 | Not logged in |
| 404 | Not the user's session, or no score file is stored (sessions created before score files were stored) |

## 2. Get the annotations

Annotations are included in two responses that the results page already uses:

- `POST /sessions/{session_id}/upload-audio`: field `score_annotations` (the `audioResult` passed to Performance Results)
- `GET /sessions/{session_id}`: field `score_annotations` (sessions reopened from practice history)

```json
{
  "notes": [
    {
      "note_id": "p0_m4_q1.0_A4",
      "part_index": 0,
      "measure": 4,
      "offset_in_measure": 1.0,
      "midi": 69,
      "beat": 2.0,
      "expected_note": "A4",
      "played_note": "A4",
      "errors": [
        {
          "type": "late",
          "category": "timing",
          "description": "Played late."
        }
      ]
    }
  ],
  "additional_notes": [
    {
      "measure": 3,
      "beat": 1.32,
      "played_note": "D5",
      "description": "An extra D5 was played that is not in the score."
    }
  ]
}
```

- `notes` lists only score notes with at least one error. Correctly played notes are not included.
- A note can have **several errors**, for example a wrong pitch that was also late.
- `additional_notes` are notes played that are not in the score, so there is no notehead to color. They are located by measure and beat only; show them separately, for example as a list under the score.
- Only notes in the measure range the user selected are analyzed.

### Error types

| `type` | `category` | Suggested color |
| --- | --- | --- |
| `incorrect_pitch` | `pitch` | Red `#ef4444` |
| `early`, `late` | `timing` | Yellow `#eab308` |
| `too_short`, `too_long` | `duration` | Orange `#f97316` |
| `missing_note` | `missing` | Purple `#a855f7` |

When a note has several errors, a suggested color priority is: missing, then pitch, then timing, then duration. The click panel can list every error's `description`.

## 3. Find each annotated note in OSMD

Match notes by **location**, not by their order in the measure. The backend and OSMD list notes in different orders when a measure has multiple voices or parts, so "the 2nd note in measure 4" can point at different notes on each side.

A score note matches an annotation when all of these are equal:

| Annotation field | OSMD value |
| --- | --- |
| `part_index` | Index of the note's instrument in `osmd.Sheet.Instruments` |
| `measure` | `sourceMeasure.MeasureNumber` (the measure number printed in the score, **not** the array index; a pickup measure is `0`) |
| `offset_in_measure` | `voiceEntry.Timestamp.RealValue * 4` (OSMD counts whole notes; the backend counts quarter notes). Compare with a small tolerance, such as `0.001`, because triplets give values like `0.3333`. |
| `midi` | `note.halfTone + 12` |

`note_id` is unique for each note, so it works as a React key or a lookup key. Don't parse it; use the fields above for matching.

```js
// Builds a lookup from annotation note_id to the OSMD note to color.
function findAnnotatedNotes(osmd, annotations) {
  const instruments = osmd.Sheet.Instruments
  const found = new Map()

  for (const measure of osmd.Sheet.SourceMeasures) {
    for (const container of measure.VerticalSourceStaffEntryContainers ?? []) {
      for (const staffEntry of container.StaffEntries ?? []) {
        if (!staffEntry) continue

        const partIndex = instruments.indexOf(
          staffEntry.ParentStaff.ParentInstrument
        )

        for (const voiceEntry of staffEntry.VoiceEntries ?? []) {
          const offsetInMeasure = voiceEntry.Timestamp.RealValue * 4

          for (const note of voiceEntry.Notes ?? []) {
            if (note.isRest()) continue

            const annotation = annotations.notes.find(
              (candidate) =>
                candidate.part_index === partIndex &&
                candidate.measure === measure.MeasureNumber &&
                Math.abs(candidate.offset_in_measure - offsetInMeasure) < 0.001 &&
                candidate.midi === note.halfTone + 12
            )

            if (annotation) {
              found.set(annotation.note_id, note)
            }
          }
        }
      }
    }
  }

  return found
}
```

Each matched OSMD note can then be colored with `note.NoteheadColor` and made clickable, as the component already does for `MOCK_ERRORS`.

### Verified cases

This matching was checked by loading scores into OSMD 2.3.1 and comparing every note with the backend:

| Score | Notes matched |
| --- | --- |
| Canon in D | 265 of 265 |
| Minuet in F | 88 of 88 |
| `public/sample_long.musicxml` | 30 of 30 |
| Test score: 6/8 pickup measure, two voices in one staff, triplets, a tie across the bar line, and a second instrument | 15 of 15 |

Each backend note matched exactly one OSMD note. Chords are not analyzed by the backend, so chord notes never have annotations.

## Notes

- **Older sessions:** sessions uploaded before this change have no stored score file (`GET /score` returns 404) and no note locations, so their `score_annotations.notes` is empty.
- **Testing:** use `backend/test_music/Canon_in_D/canon-in-d.mxl` with `canon_measures_3_6_late_note.wav`, measures 3 to 6. It produces a `late` annotation on the A4 in measure 4 (`note_id` `p0_m4_q1.0_A4`).
