import { useState } from 'react'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFileChange = (event) => {
    const file = event.target.files[0]

    if (file) {
      setSelectedFile(file)
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
    </div>
  )
}

export default App