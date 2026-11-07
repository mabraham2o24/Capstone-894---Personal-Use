
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

  // Score information returned by the backend.
  const scoreSummary = scoreResult?.summary
  const totalMeasures = scoreSummary?.num_measures
  const extractedNotes = scoreSummary?.first_notes_preview ?? []

  // Validates the selected measures before continuing.
  const handleContinue = () => {
    const start = Number(startMeasure)
    const end = Number(endMeasure)

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

  // Format unavailable values.
  const formatValue = (value) => {
    if (value == null || value === '') {
      return 'N/A'
    }

    return String(value)
  }

  // Display the selected measure range.
  const formatSelectedRange = () => {
    if (startMeasure === '' && endMeasure === '') {
      return '—'
    }

    return `${startMeasure || '—'} – ${endMeasure || '—'}`
  }

  // If this page is opened without first uploading a score,
  // show a message instead of causing an error.
  if (!sessionId || !scoreResult) {
    return (
      <div className="score-processing-page">
        <div className="processing-card">
          <h1>Score Results</h1>

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

        {/* Back to dashboard */}
        <button
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>

        {/* =====================================================
            SCORE RESULTS HEADING
            ===================================================== */}

        <div className="score-results-header">
          <h1>Score Results</h1>

          <p className="success-text">
            ✓ MusicXML score successfully processed.
          </p>
        </div>

        {/* =====================================================
            SESSION OVERVIEW
            ===================================================== */}

        <div className="score-session-overview">

          <div className="score-session-heading">
            <h2>Session Overview</h2>

            <span className="score-upload-badge">
              Score Uploaded
            </span>
          </div>

          {/* First row - file and session information */}
          <div className="score-session-info-grid">

            <div className="score-session-info-card">
              <span>MusicXML File</span>

              <strong>
                {formatValue(scoreResult.filename)}
              </strong>
            </div>

            <div className="score-session-info-card">
              <span>Session ID</span>

              <strong>
                {formatValue(sessionId)}
              </strong>
            </div>

          </div>

          {/* Second row - score statistics */}
          <div className="score-session-stats-grid">

            <div className="score-session-stat-card">
              <span className="score-session-stat-icon">
                ♫
              </span>

              <span>Total Notes</span>

              <strong>
                {formatValue(scoreSummary?.total_notes_detected)}
              </strong>
            </div>

            <div className="score-session-stat-card">
              <span className="score-session-stat-icon">
                ≡
              </span>

              <span>Measures</span>

              <strong>
                {formatValue(totalMeasures)}
              </strong>
            </div>

            <div className="score-session-stat-card">
              <span className="score-session-stat-icon">
                ◷
              </span>

              <span>Tempo</span>

              <strong className="score-tempo-value">
                {scoreSummary?.tempo_bpm
                  ? `${scoreSummary.tempo_bpm} BPM`
                  : 'Not specified'}
              </strong>
            </div>

          </div>
        </div>

        {/* =====================================================
            EXTRACTED NOTES - IMPROVED TABLE
            ===================================================== */}

        <div className="performance-section score-extracted-notes-section">
          <h2>Extracted Notes</h2>

          <p className="subtitle">
            Notes extracted from your uploaded MusicXML score.
          </p>

          <div className="score-extracted-notes-container">

            <div className="score-extracted-notes-header">
              <h3>Score Note Data</h3>

              <span className="score-extracted-notes-count">
                {extractedNotes.length} Displayed
              </span>
            </div>

            {extractedNotes.length === 0 ? (
              <p className="message">
                No extracted note preview is available.
              </p>
            ) : (
              <>
                <div className="table-container score-notes-table-container">
                  <table className="notes-table score-notes-table">
                    <thead>
                      <tr>
                        <th>Note #</th>
                        <th>Pitch</th>
                        <th>Duration</th>
                        <th>Onset</th>
                      </tr>
                    </thead>

                    <tbody>
                      {extractedNotes.map((note, index) => (
                        <tr key={index}>
                          {/* Note number */}
                          <td>{index + 1}</td>

                          {/* Pitch badges - supports individual notes and chords */}
                          <td>
                            <div className="score-note-pitch-list">
                              {note.pitches?.length ? (
                                note.pitches.map((pitch, pitchIndex) => (
                                  <span
                                    className="score-note-pitch-badge"
                                    key={`${pitch}-${pitchIndex}`}
                                  >
                                    {pitch}
                                  </span>
                                ))
                              ) : (
                                <span>N/A</span>
                              )}
                            </div>
                          </td>

                          {/* Note duration */}
                          <td>
                            {formatValue(note.duration_quarterLength)}
                          </td>

                          {/* Note onset */}
                          <td>
                            {formatValue(note.offset)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="score-notes-scroll-hint">
                  Scroll to review additional extracted notes.
                </p>
              </>
            )}
          </div>
        </div>

        {/* =====================================================
            SELECT MEASURES TO PRACTICE
            ===================================================== */}

        <div className="performance-section score-measure-selection-section">
          <h2>Select Measures to Practice</h2>

          <p className="subtitle">
            Choose the starting and ending measures
            you want to practice.
          </p>

          <div className="score-measure-selection-container">

            <div className="score-measure-availability">
              {totalMeasures != null
                ? `${totalMeasures} Measures Available`
                : 'Select Your Practice Range'}
            </div>

            <div className="measure-input-grid score-measure-input-grid">

              {/* Starting measure */}
              <div>
                <label htmlFor="start-measure">
                  Starting Measure
                </label>

                <input
                  className="measure-input"
                  id="start-measure"
                  type="number"
                  min="1"
                  max={totalMeasures ?? undefined}
                  step="1"
                  value={startMeasure}
                  onChange={(event) => {
                    setStartMeasure(event.target.value)
                    setMeasureMessage('')
                  }}
                  placeholder="Enter start"
                />
              </div>

              {/* Ending measure */}
              <div>
                <label htmlFor="end-measure">
                  Ending Measure
                </label>

                <input
                  className="measure-input"
                  id="end-measure"
                  type="number"
                  min="1"
                  max={totalMeasures ?? undefined}
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

            {/* Selected measure range preview */}
            <div className="score-selected-range">
              <span>Selected Practice Range</span>

              <strong>
                {formatSelectedRange()}
              </strong>
            </div>

            {/* Validation message */}
            {measureMessage && (
              <div className="message score-measure-message" role="alert">
                {measureMessage}
              </div>
            )}

            {/* Continue to Performance Upload */}
            <div className="page-actions score-measure-actions">
              <button
                className="upload-button"
                onClick={handleContinue}
              >
                Upload Performance
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

export default ScoreProcessing
