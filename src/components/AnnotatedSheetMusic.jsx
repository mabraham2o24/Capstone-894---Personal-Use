import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

// Sprint 4 - Backend annotation error colors and labels.
const ERROR_TYPES = {
  incorrect_pitch: {
    label: 'Incorrect Pitch',
    color: '#ef4444',
    priority: 2,
  },
  early: {
    label: 'Early Note',
    color: '#eab308',
    priority: 3,
  },
  late: {
    label: 'Late Note',
    color: '#eab308',
    priority: 3,
  },
  too_short: {
    label: 'Note Too Short',
    color: '#f97316',
    priority: 4,
  },
  too_long: {
    label: 'Note Too Long',
    color: '#f97316',
    priority: 4,
  },
  missing_note: {
    label: 'Missing Note',
    color: '#a855f7',
    priority: 1,
  },
}

const EMPTY_ANNOTATIONS = {
  notes: [],
  additional_notes: [],
}

// Determine the primary error using the backend's
// recommended color priority:
// Missing, Pitch, Timing, Duration.
function getPrimaryError(errors = []) {
  const sortedErrors = [...errors].sort(
    (first, second) =>
      (ERROR_TYPES[first.type]?.priority ?? 99) -
      (ERROR_TYPES[second.type]?.priority ?? 99)
  )

  const primaryError = sortedErrors[0]

  return {
    type: primaryError?.type || 'unknown',
    label:
      ERROR_TYPES[primaryError?.type]?.label ||
      'Performance Error',
    color:
      ERROR_TYPES[primaryError?.type]?.color ||
      '#64748b',
  }
}

// Builds a lookup from annotation note_id to the OSMD note.
//
// Match using instrument, actual measure number,
// position within the measure, and MIDI pitch.
//
// This matching function is based on the backend
// annotated sheet music API documentation.
function findAnnotatedNotes(osmd, annotations) {
  const instruments = osmd.Sheet.Instruments
  const found = new Map()

  for (const measure of osmd.Sheet.SourceMeasures) {
    for (
      const container of
      measure.VerticalSourceStaffEntryContainers ?? []
    ) {
      for (const staffEntry of container.StaffEntries ?? []) {
        if (!staffEntry) continue

        const partIndex = instruments.indexOf(
          staffEntry.ParentStaff.ParentInstrument
        )

        for (const voiceEntry of staffEntry.VoiceEntries ?? []) {
          const offsetInMeasure =
            voiceEntry.Timestamp.RealValue * 4

          for (const note of voiceEntry.Notes ?? []) {
            if (note.isRest()) continue

            const annotation = annotations.notes.find(
              (candidate) =>
                candidate.part_index === partIndex &&
                candidate.measure === measure.MeasureNumber &&
                Math.abs(
                  candidate.offset_in_measure - offsetInMeasure
                ) < 0.001 &&
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

// Generate a unique temporary rendering color for each
// annotated note. This allows each rendered note to be
// associated with its exact annotation rather than matching
// several notes using the same final error color.
function getTemporaryColor(index) {
  return `#${(0x100000 + index).toString(16).padStart(6, '0')}`
}

// Normalize SVG colors for reliable comparison.
function normalizeColor(color) {
  if (!color) return ''

  const value = color.trim().toLowerCase()

  const rgbMatch = value.match(
    /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/
  )

  if (rgbMatch) {
    return (
      '#' +
      rgbMatch
        .slice(1)
        .map((channel) =>
          Number(channel).toString(16).padStart(2, '0')
        )
        .join('')
    )
  }

  return value
}

function AnnotatedSheetMusic({
  musicXML,
  scoreAnnotations = EMPTY_ANNOTATIONS,
  scoreLoading = false,
  scoreError = '',
}) {
  const scoreContainerRef = useRef(null)
  const scoreViewportRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [instrumentName, setInstrumentName] = useState('')
  const [scoreSize, setScoreSize] = useState(null)
  const [unmatchedCount, setUnmatchedCount] = useState(0)

  // Currently selected note annotation.
  const [selectedError, setSelectedError] = useState(null)

  const annotations = scoreAnnotations ?? EMPTY_ANNOTATIONS

  const annotatedNotes = Array.isArray(annotations.notes)
    ? annotations.notes
    : EMPTY_ANNOTATIONS.notes

  const additionalNotes = Array.isArray(
    annotations.additional_notes
  )
    ? annotations.additional_notes
    : EMPTY_ANNOTATIONS.additional_notes

  useEffect(() => {
    if (!musicXML || !scoreContainerRef.current) {
      setLoading(false)
      setError('')
      setScoreSize(null)
      setSelectedError(null)
      setInstrumentName('')
      setUnmatchedCount(0)

      scoreContainerRef.current?.replaceChildren()

      return
    }

    let cancelled = false
    const container = scoreContainerRef.current
    const cleanupListeners = []

    const renderScore = async () => {
      setLoading(true)
      setError('')
      setScoreSize(null)
      setSelectedError(null)
      setUnmatchedCount(0)
      container.replaceChildren()

      try {
        // Read the instrument name from the MusicXML.
        const parser = new DOMParser()
        const xmlDocument = parser.parseFromString(
          musicXML,
          'application/xml'
        )

        if (xmlDocument.querySelector('parsererror')) {
          throw new Error('Invalid MusicXML document.')
        }

        const partName = xmlDocument
          .querySelector('score-part part-name')
          ?.textContent?.trim()

        if (!cancelled) {
          setInstrumentName(partName || 'Instrument')
        }

        // Render the notation without OSMD's title or part labels.
        const osmd = new OpenSheetMusicDisplay(container, {
          autoResize: false,
          backend: 'svg',
          drawTitle: false,
          drawPartNames: false,
          drawPartAbbreviations: false,
        })

        await osmd.load(musicXML)

        if (cancelled) return

        // Match actual backend annotations to OSMD notes.
        const matchedNotes = findAnnotatedNotes(osmd, {
          notes: annotatedNotes,
        })

        setUnmatchedCount(
          Math.max(
            0,
            annotatedNotes.length - matchedNotes.size
          )
        )

        // Store the relationship between each temporary
        // rendering color and its exact backend annotation.
        const annotationLookup = new Map()

        annotatedNotes.forEach((annotation, index) => {
          const targetNote = matchedNotes.get(
            annotation.note_id
          )

          if (!targetNote) return

          const primaryError = getPrimaryError(
            annotation.errors ?? []
          )

          const temporaryColor = getTemporaryColor(index)

          annotationLookup.set(temporaryColor, {
            ...annotation,
            color: primaryError.color,
            label: primaryError.label,
          })

          // Apply a unique temporary note color before rendering.
          targetNote.NoteheadColor = temporaryColor
          targetNote.NoteColor = temporaryColor
        })

        osmd.Zoom = 1.2
        osmd.render()

        const svg = container.querySelector('svg')

        if (!svg) {
          throw new Error('No SVG was generated.')
        }

        // Replace temporary rendering colors with the actual
        // error colors and associate each note with its
        // individual backend annotation.
        const coloredNoteheads = Array.from(
          svg.querySelectorAll('path, ellipse, polygon')
        )

        coloredNoteheads.forEach((element) => {
          const fill = normalizeColor(
            element.style.fill ||
              element.getAttribute('fill')
          )

          const matchingError = annotationLookup.get(fill)

          if (!matchingError) return

          element.setAttribute(
            'fill',
            matchingError.color
          )

          element.style.fill = matchingError.color
          element.style.cursor = 'pointer'

          element.setAttribute('role', 'button')
          element.setAttribute('tabindex', '0')

          element.setAttribute(
            'aria-label',
            `${matchingError.label}, measure ${
              matchingError.measure
            }, note ${matchingError.expected_note}`
          )

          const handleClick = () => {
            setSelectedError(matchingError)
          }

          const handleKeyDown = (event) => {
            if (
              event.key === 'Enter' ||
              event.key === ' '
            ) {
              event.preventDefault()
              setSelectedError(matchingError)
            }
          }

          element.addEventListener(
            'click',
            handleClick
          )

          element.addEventListener(
            'keydown',
            handleKeyDown
          )

          cleanupListeners.push(() => {
            element.removeEventListener(
              'click',
              handleClick
            )

            element.removeEventListener(
              'keydown',
              handleKeyDown
            )
          })
        })

        // Replace temporary stroke colors, if present,
        // with the corresponding actual error colors.
        svg.querySelectorAll('*').forEach((element) => {
          const stroke = normalizeColor(
            element.style.stroke ||
              element.getAttribute('stroke')
          )

          const matchingError =
            annotationLookup.get(stroke)

          if (matchingError) {
            element.setAttribute(
              'stroke',
              matchingError.color
            )

            element.style.stroke = matchingError.color
          }
        })

        // Find the visible notation bounds.
        // Use all top-level SVG graphics rather than only
        // the first group.
        const graphicElements = Array.from(
          svg.children
        ).filter(
          (element) =>
            typeof element.getBBox === 'function' &&
            !['defs', 'title', 'desc'].includes(
              element.tagName.toLowerCase()
            )
        )

        const boxes = graphicElements
          .map((element) => element.getBBox())
          .filter(
            (box) =>
              box.width > 0 && box.height > 0
          )

        if (boxes.length > 0) {
          const minX = Math.min(
            ...boxes.map((box) => box.x)
          )

          const minY = Math.min(
            ...boxes.map((box) => box.y)
          )

          const maxX = Math.max(
            ...boxes.map(
              (box) => box.x + box.width
            )
          )

          const maxY = Math.max(
            ...boxes.map(
              (box) => box.y + box.height
            )
          )

          // Add margins so notation is not cut off.
          const horizontalPadding = 32
          const verticalPadding = 24

          const width =
            maxX - minX + horizontalPadding * 2

          const height =
            maxY - minY + verticalPadding * 2

          svg.setAttribute(
            'viewBox',
            `${minX - horizontalPadding} ${
              minY - verticalPadding
            } ${width} ${height}`
          )

          svg.setAttribute('width', width)
          svg.setAttribute('height', height)

          svg.style.width = `${width}px`
          svg.style.height = `${height}px`
          svg.style.maxWidth = 'none'
          svg.style.display = 'block'

          if (!cancelled) {
            setScoreSize({
              width: Math.ceil(width),
              height: Math.ceil(height),
            })
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            'Unable to display the MusicXML score.'
          )

          console.error(
            'Sheet music rendering error:',
            err
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    renderScore()

    return () => {
      cancelled = true

      cleanupListeners.forEach(
        (cleanup) => cleanup()
      )
    }
  }, [musicXML, annotatedNotes])

  const isLoading = loading || scoreLoading
  const displayError = scoreError || error

  return (
    <section className="performance-section annotated-sheet-music-section">
      <h2>Annotated Sheet Music</h2>

      <p className="subtitle">
        Review your sheet music. Click a highlighted note
        to view its error details.
      </p>

      {isLoading && (
        <p role="status">
          Loading sheet music...
        </p>
      )}

      {displayError && (
        <p role="alert">
          {displayError}
        </p>
      )}

      {!musicXML &&
        !isLoading &&
        !displayError && (
          <p className="message">
            No MusicXML score is available to display
            for this practice session.
          </p>
        )}

      {/* Annotation color legend */}
      {musicXML &&
        !isLoading &&
        !displayError && (
          <div
            className="annotated-sheet-music-legend"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '12px 24px',
              margin: '18px 0',
            }}
          >
            {[
              {
                label: 'Incorrect Pitch',
                color: '#ef4444',
              },
              {
                label: 'Timing Error',
                color: '#eab308',
              },
              {
                label: 'Duration Error',
                color: '#f97316',
              },
              {
                label: 'Missing Note',
                color: '#a855f7',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: item.color,
                  }}
                />

                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

      {/* Annotation summary */}
      {musicXML &&
        !isLoading &&
        !displayError && (
          <div
            style={{
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {scoreAnnotations == null ? (
              <p>
                Note annotation data is unavailable
                for this practice session.
              </p>
            ) : annotatedNotes.length === 0 &&
              additionalNotes.length === 0 ? (
              <p>
                No note errors were reported for
                the analyzed performance.
              </p>
            ) : (
              <p>
                {annotatedNotes.length}{' '}
                {annotatedNotes.length === 1
                  ? 'score note'
                  : 'score notes'}{' '}
                with reported errors
                {' · '}
                {additionalNotes.length}{' '}
                {additionalNotes.length === 1
                  ? 'additional note'
                  : 'additional notes'}
              </p>
            )}

            {unmatchedCount > 0 && (
              <p role="status">
                {unmatchedCount}{' '}
                {unmatchedCount === 1
                  ? 'annotation could'
                  : 'annotations could'}{' '}
                not be matched to the displayed
                sheet music.
              </p>
            )}
          </div>
        )}

      {/* Sheet music display */}
      <div
        style={{
          display: musicXML && !displayError
            ? 'flex'
            : 'none',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div
          className="annotated-sheet-music-wrapper"
          style={{
            backgroundColor: '#ffffff',
            color: '#000000',
            borderRadius: '12px',
            padding: '20px',
            width: scoreSize
              ? `${scoreSize.width + 40}px`
              : '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowX: 'auto',
          }}
        >
          <h3
            style={{
              color: '#000000',
              fontSize: '18px',
              fontWeight: 600,
              textAlign: 'center',
              margin: '0 0 16px',
            }}
          >
            {instrumentName || 'Sheet Music'}
          </h3>

          <div
            ref={scoreViewportRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <div
              ref={scoreContainerRef}
              className="annotated-sheet-music-container"
              style={{
                width: scoreSize
                  ? `${scoreSize.width}px`
                  : '100%',
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* Selected note error details */}
      {selectedError &&
        !isLoading &&
        !displayError && (
          <div
            className="annotated-sheet-music-error-details"
            style={{
              marginTop: '18px',
              padding: '18px 22px',
              borderRadius: '12px',
              border: `1px solid ${selectedError.color}`,
              backgroundColor: '#252b36',
              color: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: selectedError.color,
                  fontSize: '18px',
                }}
              >
                {selectedError.label}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setSelectedError(null)
                }
                aria-label="Close error details"
                style={{
                  backgroundColor: 'transparent',
                  color: '#ffffff',
                  border: '1px solid #64748b',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 8px' }}>
              <strong>Measure:</strong>{' '}
              {selectedError.measure}
            </p>

            <p style={{ margin: '0 0 8px' }}>
              <strong>Beat:</strong>{' '}
              {selectedError.beat ?? 'Not available'}
            </p>

            <p style={{ margin: '0 0 8px' }}>
              <strong>Expected Note:</strong>{' '}
              {selectedError.expected_note}
            </p>

            <p style={{ margin: '0 0 8px' }}>
              <strong>Played Note:</strong>{' '}
              {selectedError.played_note ||
                'Not detected'}
            </p>

            {/* Display every error associated with
                the selected note. */}
            <div style={{ marginTop: '14px' }}>
              <strong>Error Details:</strong>

              <ul
                style={{
                  margin: '10px 0 0',
                  paddingLeft: '22px',
                  lineHeight: 1.6,
                }}
              >
                {(selectedError.errors ?? []).map(
                  (noteError, index) => (
                    <li
                      key={`${noteError.type}-${index}`}
                      style={{
                        marginBottom: '8px',
                      }}
                    >
                      <strong
                        style={{
                          color:
                            ERROR_TYPES[
                              noteError.type
                            ]?.color ||
                            '#ffffff',
                        }}
                      >
                        {ERROR_TYPES[
                          noteError.type
                        ]?.label ||
                          noteError.type}
                        :
                      </strong>{' '}
                      {noteError.description ||
                        'No additional description available.'}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        )}

      {/* Additional notes do not exist in the original
          score, so they are displayed separately. */}
      {!isLoading &&
        additionalNotes.length > 0 && (
          <div
            className="annotated-sheet-music-additional-notes"
            style={{
              marginTop: '24px',
              padding: '18px 22px',
              borderRadius: '12px',
              border: '1px solid #64748b',
              backgroundColor: '#252b36',
              color: '#ffffff',
            }}
          >
            <h3
              style={{
                margin: '0 0 12px',
                fontSize: '18px',
              }}
            >
              Additional Notes
            </h3>

            <p
              style={{
                margin: '0 0 16px',
                lineHeight: 1.6,
              }}
            >
              These notes were played during your
              performance but do not exist in the
              original sheet music.
            </p>

            {additionalNotes.map(
              (additionalNote, index) => (
                <div
                  key={`additional-${index}`}
                  style={{
                    padding: '12px 0',
                    borderTop: '1px solid #475569',
                  }}
                >
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>Measure:</strong>{' '}
                    {additionalNote.measure ??
                      'Not available'}
                    {' · '}
                    <strong>Beat:</strong>{' '}
                    {additionalNote.beat ??
                      'Not available'}
                  </p>

                  <p style={{ margin: '0 0 6px' }}>
                    <strong>Played Note:</strong>{' '}
                    {additionalNote.played_note ||
                      'Not available'}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {additionalNote.description ||
                      'An additional note was detected.'}
                  </p>
                </div>
              )
            )}
          </div>
        )}
    </section>
  )
}

export default AnnotatedSheetMusic