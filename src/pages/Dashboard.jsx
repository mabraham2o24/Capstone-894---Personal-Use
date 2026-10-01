import { useNavigate } from 'react-router-dom'

function Dashboard() {
  // Allows buttons on the dashboard to navigate to other pages.
  const navigate = useNavigate()

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Virtual Music Instructor</h1>
          <p>Practice smarter. Improve your performance.</p>
        </div>

        {/* Temporary logout navigation.
            Real authentication/logout logic will be added later. */}
        <button
          className="logout-button"
          onClick={() => navigate('/')}
        >
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-welcome">
          <h2>Welcome</h2>

          <p>
            Start a new practice session to analyze your music
            and performance.
          </p>
        </div>

        <div className="dashboard-features">
          {/* Starts the complete Sprint 1 practice workflow */}
          <div className="feature-card">
            <div className="feature-icon">🎼</div>

            <h3>New Practice Session</h3>

            <p>
              Upload a MusicXML score, review the extracted score
              information, and submit a recorded performance for
              analysis.
            </p>

            <button
              className="feature-button"
              onClick={() => navigate('/practice')}
            >
              Start Practice Session
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard