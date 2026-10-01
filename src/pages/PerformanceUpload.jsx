import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function PerformanceUpload() {
  // Allows navigation between application pages.
  const navigate = useNavigate()

  // Gets the current practice session information
  // passed from the Score Processing page.
  const location = useLocation()

  const sessionId = location.state?.sessionId
  const scoreResult = location.state?.scoreResult

  // Audio performance state.
  const [audioFile, setAudioFile] = useState(null)
  const [audioMessage, setAudioMessage] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)

  // Handles selection of an existing WAV performance.
  const handleAudioFileChange = (event) => {
    const file = event.target.files[0]

    if (file) {
      setAudioFile(file)
      setAudioMessage('')
    }
  }

  // Uploads the WAV performance to the current practice session.
  const handleAudioUpload = async () => {
    if (!audioFile) {
      setAudioMessage('Please choose a WAV audio file first.')
      return
    }

    if (!sessionId) {
      setAudioMessage('No active practice session was found.')
      return
    }

    setAudioLoading(true)
    setAudioMessage('')

    try {
      // Prepare the audio file for the FastAPI endpoint.
      const formData = new FormData()
      formData.append('file', audioFile)

      // Send the WAV file to the existing audio-analysis endpoint.
      const audioResponse = await fetch(
        `http://127.0.0.1:8000/sessions/${sessionId}/upload-audio`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const audioData = await audioResponse.json()

      if (!audioResponse.ok) {
        throw new Error(
          audioData.detail || 'Audio upload failed.'
        )
      }

      // After successful analysis, go to the
      // Performance Processing page.
      navigate('/performance-results', {
        state: {
          sessionId: sessionId,
          scoreResult: scoreResult,
          audioResult: audioData,
        },
      })
    } catch (error) {
      setAudioMessage(error.message)
    } finally {
      setAudioLoading(false)
    }
  }

  // Prevents this page from being used without a practice session.
  if (!sessionId || !scoreResult) {
    return (
      <div className="performance-upload-page">
        <div className="performance-card">
          <h1>Add Your Performance</h1>

          <p className="message">
            No active practice session is available.
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
    <div className="performance-upload-page">
      <div className="performance-card">
        <button
          className="back-button"
          onClick={() =>
            navigate('/score-processing', {
              state: {
                sessionId: sessionId,
                scoreResult: scoreResult,
              },
            })
          }
        >
          ← Back to Score
        </button>

        <h1>Add Your Performance</h1>

        <p className="subtitle">
          Upload a WAV recording of your performance.
        </p>

        {/* Shows which practice session and score
            this performance will belong to. */}
        <div className="summary-grid">
          <div>
            <span>Session ID</span>
            <strong>{sessionId}</strong>
          </div>

          <div>
            <span>MusicXML File</span>
            <strong>{scoreResult.filename}</strong>
          </div>
        </div>

        <div className="upload-section">
          <label className="file-label">
            Choose Audio File

            <input
              type="file"
              accept=".wav,audio/wav"
              onChange={handleAudioFileChange}
            />
          </label>

          {audioFile && (
            <div className="selected-file">
              Selected file:
              <strong>{audioFile.name}</strong>
            </div>
          )}

          <button
            className="upload-button"
            onClick={handleAudioUpload}
            disabled={audioLoading}
          >
            {audioLoading
              ? 'Processing Audio...'
              : 'Upload Performance'}
          </button>
        </div>

        {audioMessage && (
          <div className="message">
            {audioMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export default PerformanceUpload