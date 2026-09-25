import { Routes, Route } from 'react-router-dom'
import './App.css'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PracticeSession from './pages/PracticeSession.jsx'
import ScoreProcessing from './pages/ScoreProcessing.jsx'
import PerformanceUpload from './pages/PerformanceUpload.jsx'
import PerformanceResults from './pages/PerformanceResults.jsx'

function App() {
  return (
    <Routes>
      {/* Temporary login page.
          Real authentication will be implemented later. */}
      <Route path="/" element={<Login />} />

      {/* Main application dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Creates a practice session and uploads a MusicXML score */}
      <Route path="/practice" element={<PracticeSession />} />

      {/* Displays the processed MusicXML score information */}
      <Route
        path="/score-processing"
        element={<ScoreProcessing />}
      />

      {/* Uploads a WAV performance to the current practice session */}
      <Route
        path="/performance-upload"
        element={<PerformanceUpload />}
      />

      {/* Displays the processed audio performance information */}
      <Route
        path="/performance-results"
        element={<PerformanceResults />}
      />
    </Routes>
  )
}

export default App