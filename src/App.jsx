import { useState } from 'react'

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
      const sessionResponse = await fetch('http://127.0.0.1:8000/sessions', {
        method: 'POST',
      })

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
        throw new Error(uploadData.detail || 'Score upload failed.')
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
    <div>
      <h1>Virtual Music Instructor</h1>
      <p>Upload a MusicXML file to begin.</p>

      <input
        type="file"
        accept=".xml,.musicxml"
        onChange={handleFileChange}
      />

      {selectedFile && (
        <p>Selected file: {selectedFile.name}</p>
      )}

      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Processing...' : 'Upload Score'}
      </button>

      {message && <p>{message}</p>}

      {result && (
        <div>
          <h2>Score Summary</h2>
          <p>Filename: {result.filename}</p>
          <p>Status: {result.status}</p>
          <p>Total Notes: {result.summary.total_notes_detected}</p>
          <p>Measures: {result.summary.num_measures}</p>
          <p>
            Tempo:{' '}
            {result.summary.tempo_bpm
              ? `${result.summary.tempo_bpm} BPM`
              : 'Not specified'}
          </p>
        </div>
      )}
    </div>
  )
}

export default App