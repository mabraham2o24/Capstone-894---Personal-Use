import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { isLoggedIn, requestLogin } from '../auth.js'
import GoogleSignInButton from '../components/GoogleSignInButton.jsx'

// Matches the backend's password rule.
const MIN_PASSWORD_LENGTH = 8

function Signup() {
  // Stores the values entered into the sign-up form.
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const completeSignup = async (path, body) => {
    setError('')
    setLoading(true)

    try {
      await requestLogin(path, body)
      navigate('/dashboard', { replace: true })
    } catch (signupError) {
      setError(signupError.message)
      setLoading(false)
    }
  }

  const handleSignup = (event) => {
    event.preventDefault()

    if (!email.trim() || !password) {
      setError('Enter your email and a password.')
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    completeSignup('/auth/signup', { name, email, password })
  }

  const handleGoogleCredential = (credential) => {
    completeSignup('/auth/google', { credential })
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
          Create an account to save your practice sessions.
        </p>

        <form className="login-form" onSubmit={handleSignup} noValidate>
          <div className="form-group">
            <label htmlFor="name">Name</label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your name (optional)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

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
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>

            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your password again"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          onError={setError}
          text="signup_with"
        />

        <p className="signup-text">
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  )
}

export default Signup
