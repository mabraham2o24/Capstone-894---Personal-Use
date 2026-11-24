import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { isLoggedIn, LOGOUT_EVENT } from '../auth.js'

// Shows its page only to logged-in users. Everyone else is sent to the
// Login page, which returns them here after they log in.
function RequireAuth({ children }) {
  const location = useLocation()
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)

  useEffect(() => {
    const updateLoginState = () => setLoggedIn(isLoggedIn())

    // Logging out in this tab, an expired login, or logging out in
    // another tab all end the session here too.
    window.addEventListener(LOGOUT_EVENT, updateLoginState)
    window.addEventListener('storage', updateLoginState)

    return () => {
      window.removeEventListener(LOGOUT_EVENT, updateLoginState)
      window.removeEventListener('storage', updateLoginState)
    }
  }, [])

  if (!loggedIn) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}

export default RequireAuth
