import { useLocation, useNavigate } from 'react-router-dom'

function ScoreProcessing() {
  // Allows navigation to other pages.
  const navigate = useNavigate()

  // Gets the session ID and MusicXML processing results
  // passed from the Practice Session page.
  const location = useLocation()

  const sessionId = location.state?.sessionId
  const scoreResult = location.state?.scoreResult

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

        {/* Continues the same practice session to audio upload */}
        <div className="page-actions">
          <button
            className="upload-button"
            onClick={() =>
              navigate('/performance-upload', {
                state: {
                  sessionId: sessionId,
                  scoreResult: scoreResult,
                },
              })
            }
          >
            Upload Performance
          </button>
        </div>
      </div>
    </div>
  )
}

export default ScoreProcessing