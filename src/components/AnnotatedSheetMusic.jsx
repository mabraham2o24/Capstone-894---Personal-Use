
import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

// Sprint 4 - Temporary mock errors.
// These will eventually be replaced with backend feedback.
const MOCK_ERRORS = [
  {
    measure: 1,
    noteIndex: 0,
    note: 'E4',
    type: 'Incorrect Pitch',
    color: '#ef4444',
    description:
      'The performed pitch does not match the expected E4 note.',
  },
  {
    measure: 2,
    noteIndex: 1,
    note: 'C5',
    type: 'Timing Error',
    color: '#eab308',
    description:
      'The note was played earlier or later than its expected position.',
  },
  {
    measure: 3,
    noteIndex: 0,
    note: 'F5',
    type: 'Duration Error',
    color: '#f97316',
    description:
      'The note was held for a different duration than expected.',
  },
  {
    measure: 5,
    noteIndex: 0,
    note: 'F4',
    type: 'Missing Note',
    color: '#a855f7',
    description:
      'The expected note was not detected in the performance.',
  },
]

function AnnotatedSheetMusic({ musicXML }) {
  const scoreContainerRef = useRef(null)
  const scoreViewportRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [instrumentName, setInstrumentName] = useState('')
  const [scoreSize, setScoreSize] = useState(null)

  // Currently selected error.
  const [selectedError, setSelectedError] = useState(null)

  useEffect(() => {
    if (!musicXML || !scoreContainerRef.current) {
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

        // Apply mock note colors before rendering.
        const sourceMeasures = osmd.Sheet?.SourceMeasures ?? []

        MOCK_ERRORS.forEach((mockError) => {
          const measure = sourceMeasures[mockError.measure - 1]

          if (!measure) return

          const notes = []

          const staffEntries =
            measure.VerticalSourceStaffEntryContainers ?? []

          staffEntries.forEach((containerEntry) => {
            const entries = containerEntry.StaffEntries ?? []

            entries.forEach((staffEntry) => {
              if (!staffEntry) return

              const voiceEntries = staffEntry.VoiceEntries ?? []

              voiceEntries.forEach((voiceEntry) => {
                const voiceNotes = voiceEntry.Notes ?? []

                voiceNotes.forEach((note) => {
                  if (!note.isRest()) {
                    notes.push(note)
                  }
                })
              })
            })
          })

          const targetNote = notes[mockError.noteIndex]

          if (targetNote) {
            targetNote.NoteheadColor = mockError.color
            targetNote.NoteColor = mockError.color
          }
        })

        osmd.Zoom = 1.2
        osmd.render()

        const svg = container.querySelector('svg')

        if (!svg) {
          throw new Error('No SVG was generated.')
        }

        // Add click interaction to colored noteheads.
        // This is temporary frontend-only interaction for Sprint 4.
        const coloredNoteheads = Array.from(
          svg.querySelectorAll('path, ellipse, polygon')
        ).filter((element) => {
          const fill = (
            element.getAttribute('fill') ||
            element.style.fill ||
            ''
          ).toLowerCase()

          return MOCK_ERRORS.some(
            (mockError) => fill === mockError.color.toLowerCase()
          )
        })

        coloredNoteheads.forEach((element) => {
          const fill = (
            element.getAttribute('fill') ||
            element.style.fill ||
            ''
          ).toLowerCase()

          const matchingError = MOCK_ERRORS.find(
            (mockError) =>
              mockError.color.toLowerCase() === fill
          )

          if (!matchingError) return

          element.style.cursor = 'pointer'
          element.setAttribute('role', 'button')
          element.setAttribute('tabindex', '0')
          element.setAttribute(
            'aria-label',
            `${matchingError.type}, measure ${matchingError.measure}, note ${matchingError.note}`
          )

          const handleClick = () => {
            setSelectedError(matchingError)
          }

          const handleKeyDown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSelectedError(matchingError)
            }
          }

          element.addEventListener('click', handleClick)
          element.addEventListener('keydown', handleKeyDown)

          cleanupListeners.push(() => {
            element.removeEventListener('click', handleClick)
            element.removeEventListener('keydown', handleKeyDown)
          })
        })

        // Find the visible notation bounds.
        // Use all top-level SVG graphics rather than only the first group.
        const graphicElements = Array.from(svg.children).filter(
          (element) =>
            typeof element.getBBox === 'function' &&
            !['defs', 'title', 'desc'].includes(
              element.tagName.toLowerCase()
            )
        )

        const boxes = graphicElements
          .map((element) => element.getBBox())
          .filter((box) => box.width > 0 && box.height > 0)

        if (boxes.length > 0) {
          const minX = Math.min(...boxes.map((box) => box.x))
          const minY = Math.min(...boxes.map((box) => box.y))
          const maxX = Math.max(
            ...boxes.map((box) => box.x + box.width)
          )
          const maxY = Math.max(
            ...boxes.map((box) => box.y + box.height)
          )

          // Add margins so notation is not cut off.
          const horizontalPadding = 32
          const verticalPadding = 24

          const width = maxX - minX + horizontalPadding * 2
          const height = maxY - minY + verticalPadding * 2

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
          setError('Unable to display the MusicXML score.')
          console.error('Sheet music rendering error:', err)
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
      cleanupListeners.forEach((cleanup) => cleanup())
    }
  }, [musicXML])

  return (
    <section className="performance-section annotated-sheet-music-section">
      <h2>Annotated Sheet Music</h2>

      <p className="subtitle">
        Review your sheet music. Click a highlighted note
        to view its error details.
      </p>

      {loading && <p role="status">Loading sheet music...</p>}

      {error && <p role="alert">{error}</p>}

      {!musicXML && (
        <p className="message">
          No MusicXML score is available to display.
        </p>
      )}

      <div
        style={{
          display: 'flex',
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
      {selectedError && (
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
              {selectedError.type}
            </h3>

            <button
              type="button"
              onClick={() => setSelectedError(null)}
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
            <strong>Measure:</strong> {selectedError.measure}
          </p>

          <p style={{ margin: '0 0 8px' }}>
            <strong>Expected Note:</strong> {selectedError.note}
          </p>

          <p style={{ margin: 0, lineHeight: 1.6 }}>
            <strong>Explanation:</strong>{' '}
            {selectedError.description}
          </p>
        </div>
      )}
    </section>
  )
}

export default AnnotatedSheetMusic
