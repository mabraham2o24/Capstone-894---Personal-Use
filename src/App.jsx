import { Routes, Route } from 'react-router-dom'
import './App.css'

import RequireAuth from './components/RequireAuth.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PracticeSession from './pages/PracticeSession.jsx'
import ScoreProcessing from './pages/ScoreProcessing.jsx'
import PerformanceUpload from './pages/PerformanceUpload.jsx'
import PerformanceResults from './pages/PerformanceResults.jsx'

function App() {
  return (
    <Routes>
      {/* Login with email and password or Google */}
      <Route path="/" element={<Login />} />

      {/* Creates a new account */}
      <Route path="/signup" element={<Signup />} />

      {/* The pages below require a logged-in user */}

      {/* Main application dashboard */}
      <Route
        path="/dashboard"
        element={<RequireAuth><Dashboard /></RequireAuth>}
      />

      {/* Creates a practice session and uploads a MusicXML score */}
      <Route
        path="/practice"
        element={<RequireAuth><PracticeSession /></RequireAuth>}
      />

      {/* Displays the processed MusicXML score information */}
      <Route
        path="/score-processing"
        element={<RequireAuth><ScoreProcessing /></RequireAuth>}
      />

      {/* Uploads a WAV performance to the current practice session */}
      <Route
        path="/performance-upload"
        element={<RequireAuth><PerformanceUpload /></RequireAuth>}
      />

      {/* Displays the processed audio performance information */}
      <Route
        path="/performance-results"
        element={<RequireAuth><PerformanceResults /></RequireAuth>}
      />
    </Routes>
  )
}

export default App
