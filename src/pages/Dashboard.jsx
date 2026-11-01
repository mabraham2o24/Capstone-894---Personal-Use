
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  // Allows buttons on the dashboard to navigate to other pages.
  const navigate = useNavigate()

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-brand-icon">♫</div>

          <div>
            <h1>Virtual Music Instructor</h1>
            <p>Practice smarter. Improve your performance.</p>
          </div>
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
        {/* Welcome section with the main practice button */}
        <section className="dashboard-welcome">
          <span className="dashboard-eyebrow">
            YOUR PRACTICE SPACE
          </span>

          <h2>Make every practice session count.</h2>

          <p>
            Upload a MusicXML score, select the measures you want
            to practice, and analyze your recorded performance
            with feedback on pitch, timing, and note duration.
          </p>

          <button
            className="dashboard-primary-button"
            onClick={() => navigate('/practice')}
          >
            Start Practice Session
            <span aria-hidden="true">→</span>
          </button>
        </section>

        {/* Informational overview of the existing workflow */}
        <section className="dashboard-workflow-section">
          <div className="dashboard-section-heading">
            <h2>How It Works</h2>
            <p>
              Three simple steps to review your performance.
            </p>
          </div>

          <div className="dashboard-workflow-grid">
            {/* Step 1 */}
            <div className="dashboard-step-card">
              <div className="dashboard-step-number">01</div>
              <div className="dashboard-step-icon">🎵</div>

              <h3>Upload Your Score</h3>

              <p>
                Upload a MusicXML file to begin your
                practice session.
              </p>
            </div>

            {/* Step 2 */}
            <div className="dashboard-step-card">
              <div className="dashboard-step-number">02</div>
              <div className="dashboard-step-icon">🎯</div>

              <h3>Select Your Measures</h3>

              <p>
                Choose the starting and ending measures
                you want to practice.
              </p>
            </div>

            {/* Step 3 */}
            <div className="dashboard-step-card">
              <div className="dashboard-step-number">03</div>
              <div className="dashboard-step-icon">📊</div>

              <h3>Review Your Feedback</h3>

              <p>
                Upload your recorded performance and review
                pitch, timing, and duration feedback.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
