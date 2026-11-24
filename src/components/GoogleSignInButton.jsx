import { useEffect, useRef } from 'react'

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

// Loads Google Identity Services once, however many buttons are shown.
let googleScriptPromise = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GOOGLE_SCRIPT_URL
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = () => {
        googleScriptPromise = null
        reject(new Error('Google sign-in could not be loaded.'))
      }
      document.head.appendChild(script)
    })
  }

  return googleScriptPromise
}

// Google's "Sign in with Google" button. onCredential receives the ID
// token for the backend to verify. Nothing is shown when no Google client
// ID is configured (VITE_GOOGLE_CLIENT_ID in the frontend .env).
function GoogleSignInButton({ onCredential, onError, text = 'signin_with' }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const buttonRef = useRef(null)

  // Keep the latest handlers without reinitializing Google's button.
  const handlersRef = useRef({ onCredential, onError })

  useEffect(() => {
    handlersRef.current = { onCredential, onError }
  })

  useEffect(() => {
    if (!clientId) {
      return
    }

    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) =>
            handlersRef.current.onCredential(response.credential),
        })

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          text,
          width: 356,
        })
      })
      .catch((error) => {
        if (!cancelled) {
          handlersRef.current.onError?.(error.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [clientId, text])

  if (!clientId) {
    return null
  }

  return (
    <>
      <div className="login-divider">
        <span>or</span>
      </div>

      <div
        className="google-signin-button"
        ref={buttonRef}
        data-testid="google-signin-button"
      />
    </>
  )
}

export default GoogleSignInButton
