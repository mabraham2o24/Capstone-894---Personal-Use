import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function PracticeSession() {
  // Allows this page to navigate to other application pages.
  const navigate = useNavigate()

  // Stores the selected MusicXML file.
  const [selectedFile, setSelectedFile] = useState(null)

  // Stores upload status and error messages.
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Handles selection of the MusicXML score.
  const handleFileChange = (event) => {
    const file = event.target.files[0]

    if (file) {
      setSelectedFile(file)
      setMessage('')
    }
  }

  // Creates a practice session and uploads the selected MusicXML score.
  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please choose a MusicXML file first.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // Create a new practice session.
      const sessionResponse = await fetch(
        'http://127.0.0.1:8000/sessions',
        {
          method: 'POST',
        }
      )

      if (!sessionResponse.ok) {
        throw new Error('Could not create a practice session.')
      }

      const sessionData = await sessionResponse.json()

      // Prepare the MusicXML file for upload.
      const formData = new FormData()
      formData.append('file', selectedFile)

      // Upload the MusicXML score to the new practice session.
      const uploadResponse = await fetch(
        `http://127.0.0.1:8000/sessions/${sessionData.session_id}/upload-score`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const uploadData = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(
          uploadData.detail || 'Score upload failed.'
        )
      }

      // After successful processing, go to the Score Processing page.
      // The session ID and score results are passed to that page.
      navigate('/score-processing', {
        state: {
          sessionId: sessionData.session_id,
          scoreResult: uploadData,
        },
      })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="practice-page">
      <div className="practice-card">
        <button
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>

        <h1>New Practice Session</h1>

        <p className="subtitle">
          Upload a MusicXML score to begin your practice session.
        </p>

        <div className="upload-section">
          <label className="file-label">
            Choose MusicXML File

            <input
              type="file"
              accept=".xml,.musicxml"
              onChange={handleFileChange}
            />
          </label>

          {selectedFile && (
            <div className="selected-file">
              Selected file:
              <strong>{selectedFile.name}</strong>
            </div>
          )}

          <button
            className="upload-button"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Upload Score'}
          </button>
        </div>

        {message && (
          <div className="message">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default PracticeSession