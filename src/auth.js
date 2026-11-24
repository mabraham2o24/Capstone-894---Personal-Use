// Login state shared by every page.
//
// After logging in, the backend returns an access token. It is kept in
// localStorage and sent as "Authorization: Bearer <token>" on every
// backend request made through authFetch.

export const API_BASE_URL = 'http://127.0.0.1:8000'

const TOKEN_KEY = 'vmi_access_token'
const USER_KEY = 'vmi_user'

// Fired when the user logs out or the backend rejects the stored token,
// so RequireAuth can return to the Login page.
export const LOGOUT_EVENT = 'vmi-logout'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const storedUser = localStorage.getItem(USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser)
  } catch {
    return null
  }
}

export function isLoggedIn() {
  return Boolean(getToken())
}

// Stores the token and user returned by the login, sign-up, and Google
// sign-in endpoints.
export function saveLogin(loginResponse) {
  localStorage.setItem(TOKEN_KEY, loginResponse.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user))
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event(LOGOUT_EVENT))
}

// Sends a request to the backend as the logged-in user.
// If the backend rejects the login, the user is logged out.
export async function authFetch(path, options = {}) {
  const token = getToken()

  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    logout()
  }

  return response
}

// Sends login, sign-up, or Google sign-in details and stores the
// resulting login. Throws an Error with the backend's message on failure.
export async function requestLogin(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof data.detail === 'string'
        ? data.detail
        : 'Something went wrong. Please try again.'
    )
  }

  saveLogin(data)

  return data
}
