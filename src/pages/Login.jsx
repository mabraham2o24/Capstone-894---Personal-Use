import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Login() {
  // Stores the values entered into the login form.
  // Real authentication will be connected in a future sprint.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Allows this page to navigate to another route.
  const navigate = useNavigate()

  const handleLogin = (event) => {
    event.preventDefault()

    // Temporary navigation for frontend development.
    // Replace this with real authentication logic in a future sprint.
    navigate('/dashboard')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Virtual Music Instructor</h1>

        <p className="login-subtitle">
          Sign in to continue your practice.
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button className="login-button" type="submit">
            Login
          </button>
        </form>

        <p className="signup-text">
          Don't have an account? <span>Sign Up</span>
        </p>
      </div>
    </div>
  )
}

export default Login