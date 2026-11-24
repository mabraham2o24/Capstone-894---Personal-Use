import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { isLoggedIn, requestLogin } from '../auth.js'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'

function Login() {
  // Stores the values entered into the login form.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Allows this page to navigate to another route.
  const navigate = useNavigate()
  const location = useLocation()

  // After logging in, return to the page the user tried to open.
  const destination = location.state?.from?.pathname || '/dashboard'

  const completeLogin = async (path, body) => {
    setError('')
    setLoading(true)

    try {
      await requestLogin(path, body)
      navigate(destination, { replace: true })
    } catch (loginError) {
      setError(loginError.message)
      setLoading(false)
    }
  }

  const handleLogin = (event) => {
    event.preventDefault()

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    completeLogin('/auth/login', { email, password })
  }

  const handleGoogleCredential = (credential) => {
    completeLogin('/auth/google', { credential })
  }

  // A logged-in user has nothing to do here.
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Virtual Music Instructor</h1>

        <p className="login-subtitle">
          Sign in to continue your practice.
        </p>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              autoComplete="email"
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
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          onError={setError}
        />

        <p className="signup-text">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
