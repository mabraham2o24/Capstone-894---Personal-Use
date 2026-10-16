
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function ScoreProcessing() {
  // Allows navigation to other pages.
  const navigate = useNavigate()

  // Gets the session ID and MusicXML processing results
  // passed from the Practice Session page.
  const location = useLocation()

  const sessionId = location.state?.sessionId
  const scoreResult = location.state?.scoreResult

  // Stores the measure range entered by the user.
  const [startMeasure, setStartMeasure] = useState('')
  const [endMeasure, setEndMeasure] = useState('')
  const [measureMessage, setMeasureMessage] = useState('')

  // Validates the selected measures before continuing.
  const handleContinue = () => {
    const start = Number(startMeasure)
    const end = Number(endMeasure)
    const totalMeasures = scoreResult?.summary?.num_measures

    if (startMeasure === '' || endMeasure === '') {
      setMeasureMessage('Please enter both starting and ending measures.')
      return
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < 1
    ) {
      setMeasureMessage('Please enter valid whole-number measures.')
      return
    }

    if (start > end) {
      setMeasureMessage(
        'Starting measure cannot be greater than ending measure.'
      )
      return
    }

    if (totalMeasures != null && end > totalMeasures) {
      setMeasureMessage(
        `Ending measure cannot exceed ${totalMeasures}.`
      )
      return
    }

    setMeasureMessage('')

    // Pass the selected measures to the Performance Upload page.
    navigate('/performance-upload', {
      state: {
        sessionId: sessionId,
        scoreResult: scoreResult,
        startMeasure: start,
        endMeasure: end,
      },
    })
  }

  // If this page is opened without first uploading a score,
  // show a message instead of causing an error.
  if (!sessionId || !scoreResult) {
    return (
      <div className="score-processing-page">
        <div className="processing-card">
          <h1>Score Processing</h1>

          <p className="message">
            No processed MusicXML score is available.
          </p>

          <button
            className="back-button"
            onClick={() => navigate('/practice')}
          >
            ← Start a Practice Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="score-processing-page">
      <div className="processing-card">
        <button
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>

        <h1>Score Processing</h1>

        <p className="success-text">
          MusicXML score successfully processed.
        </p>

        {/* General information about the uploaded score */}
        <div className="summary-grid">
          <div>
            <span>Session ID</span>
            <strong>{sessionId}</strong>
          </div>

          <div>
            <span>MusicXML File</span>
            <strong>{scoreResult.filename}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{scoreResult.status}</strong>
          </div>

          <div>
            <span>Total Notes</span>
            <strong>
              {scoreResult.summary.total_notes_detected}
            </strong>
          </div>

          <div>
            <span>Measures</span>
            <strong>
              {scoreResult.summary.num_measures}
            </strong>
          </div>

          <div>
            <span>Tempo</span>
            <strong>
              {scoreResult.summary.tempo_bpm
                ? `${scoreResult.summary.tempo_bpm} BPM`
                : 'Not specified'}
            </strong>
          </div>
        </div>

        {/* Notes extracted from the MusicXML score */}
        <div className="performance-section">
          <h2>Extracted Notes</h2>

          <div className="table-container">
            <table className="notes-table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Pitch</th>
                  <th>Duration</th>
                  <th>Onset</th>
                </tr>
              </thead>

              <tbody>
                {scoreResult.summary.first_notes_preview.map(
                  (note, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>

                      <td>
                        {note.pitches.join(', ')}
                      </td>

                      <td>
                        {note.duration_quarterLength}
                      </td>

                      <td>{note.offset}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Allows the user to select the measures to practice */}
        <div className="performance-section">
          <h2>Select Measures to Practice</h2>

          <p className="subtitle">
            Enter the starting and ending measures you want to practice.
          </p>

          <div className="summary-grid">
            <div>
              <label htmlFor="start-measure">
                Starting Measure
              </label>

              <input
                id="start-measure"
                type="number"
                min="1"
                max={scoreResult.summary.num_measures ?? undefined}
                step="1"
                value={startMeasure}
                onChange={(event) => {
                  setStartMeasure(event.target.value)
                  setMeasureMessage('')
                }}
                placeholder="Enter start"
              />
            </div>

            <div>
              <label htmlFor="end-measure">
                Ending Measure
              </label>

              <input
                id="end-measure"
                type="number"
                min="1"
                max={scoreResult.summary.num_measures ?? undefined}
                step="1"
                value={endMeasure}
                onChange={(event) => {
                  setEndMeasure(event.target.value)
                  setMeasureMessage('')
                }}
                placeholder="Enter end"
              />
            </div>
          </div>

          {measureMessage && (
            <div className="message">
              {measureMessage}
            </div>
          )}
        </div>

        {/* Continues the same practice session to audio upload */}
        <div className="page-actions">
          <button
            className="upload-button"
            onClick={handleContinue}
          >
            Upload Performance
          </button>
        </div>
      </div>
    </div>
  )
}

export default ScoreProcessing
