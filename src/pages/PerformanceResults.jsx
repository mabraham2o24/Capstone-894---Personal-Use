import { useLocation, useNavigate } from 'react-router-dom'

function PerformanceResults() {
  // Allows navigation between application pages.
  const navigate = useNavigate()

  // Gets the practice session, score, and audio-analysis
  // information passed from the Performance Upload page.
  const location = useLocation()

  const sessionId = location.state?.sessionId
  const scoreResult = location.state?.scoreResult
  const audioResult = location.state?.audioResult

  // Prevents the page from causing an error if it is opened
  // without first uploading and processing a performance.
  if (!sessionId || !audioResult) {
    return (
      <div className="performance-results-page">
        <div className="performance-card">
          <h1>Performance Processing</h1>

          <p className="message">
            No processed performance is available.
          </p>

          <button
            className="back-button"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="performance-results-page">
      <div className="performance-card">

        <button
          className="back-button"
          onClick={() =>
            navigate('/performance-upload', {
              state: {
                sessionId: sessionId,
                scoreResult: scoreResult,
              },
            })
          }
        >
          ← Back to Performance Upload
        </button>

        <h1>Performance Processing</h1>

        <p className="success-text">
          Audio successfully processed.
        </p>

        {/* General information about the analyzed performance */}
        <div className="summary-grid">
          <div>
            <span>Session ID</span>
            <strong>{sessionId}</strong>
          </div>

          <div>
            <span>Audio File</span>
            <strong>{audioResult.filename}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{audioResult.status}</strong>
          </div>

          <div>
            <span>Detected Pitches</span>
            <strong>
              {audioResult.detected_pitches.length}
            </strong>
          </div>

          <div>
            <span>Total Note Events</span>
            <strong>
              {audioResult.note_events.length}
            </strong>
          </div>
        </div>

        {/* Displays the pitches detected in the audio */}
        <div className="performance-section">
          <h2>Detected Pitches</h2>

          <p className="detected-pitches">
            {audioResult.detected_pitches.join(', ')}
          </p>
        </div>

        {/* Displays each detected note event */}
        <div className="performance-section">
          <h2>Detected Notes</h2>

          <div className="table-container">
            <table className="notes-table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Pitch</th>
                  <th>Duration</th>
                  <th>Onset Time</th>
                </tr>
              </thead>

              <tbody>
                {audioResult.note_events.map(
                  (note, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{note.pitch}</td>
                      <td>{note.duration} sec</td>
                      <td>{note.onset} sec</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="page-actions">
          <button
            className="upload-button"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  )
}

export default PerformanceResults