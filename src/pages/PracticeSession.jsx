
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function PracticeSession() {
  // Allows navigation between application pages.
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

  // Creates a practice session and uploads the selected score.
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

      // Upload the MusicXML score.
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

      // Navigate to the Score Processing page.
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
      <div className="practice-card practice-card-simple">

        {/* Back navigation */}
        <div className="practice-simple-topbar">
          <button
            className="back-button"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Page heading */}
        <div className="practice-simple-heading">
          <h1>New Practice Session</h1>

          <p className="subtitle">
            Upload your MusicXML score to get started.
          </p>
        </div>

        {/* File upload section */}
        <div className="practice-simple-upload">
          <div className="practice-simple-upload-header">
            <h2>Upload Music Score</h2>

            <p>
              Select a MusicXML file from your device.
            </p>
          </div>

          <label className="file-label practice-simple-file-label">
            Choose MusicXML File

            <input
              type="file"
              accept=".xml,.musicxml,.mxl"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>

          {/* Selected file information */}
          {selectedFile && (
            <div className="practice-simple-selected-file">
              <span>Selected File</span>
              <strong>{selectedFile.name}</strong>
            </div>
          )}

          <button
            className="upload-button practice-simple-upload-button"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Upload Score →'}
          </button>
        </div>

        {/* Error messages */}
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
