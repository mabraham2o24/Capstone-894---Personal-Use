import { useState } from 'react'
import './App.css'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (event) => {
    const file = event.target.files[0]

    if (file) {
      setSelectedFile(file)
      setMessage('')
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please choose a MusicXML file first.')
      return
    }

    setLoading(true)
    setMessage('')
    setResult(null)

    try {
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

      const formData = new FormData()
      formData.append('file', selectedFile)

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

      setResult(uploadData)
      setMessage('MusicXML uploaded and processed successfully.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div className="card">
        <h1>Virtual Music Instructor</h1>

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
          <div
            className={
              result
                ? 'message success-message'
                : 'message'
            }
          >
            {message}
          </div>
        )}

        {result && (
          <div className="summary-card">
            <h2>Score Summary</h2>

            <div className="summary-grid">
              <div>
                <span>Filename</span>
                <strong>{result.filename}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{result.status}</strong>
              </div>

              <div>
                <span>Total Notes</span>
                <strong>
                  {result.summary.total_notes_detected}
                </strong>
              </div>

              <div>
                <span>Measures</span>
                <strong>
                  {result.summary.num_measures}
                </strong>
              </div>

              <div>
                <span>Tempo</span>
                <strong>
                  {result.summary.tempo_bpm
                    ? `${result.summary.tempo_bpm} BPM`
                    : 'Not specified'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App