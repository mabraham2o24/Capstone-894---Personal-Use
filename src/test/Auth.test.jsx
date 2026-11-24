import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import RequireAuth from '../components/RequireAuth.jsx'
import Login from '../pages/Login.jsx'
import {
  authFetch,
  getToken,
  logout,
  saveLogin,
} from '../auth.js'

const mockLogin = {
  access_token: 'test-token',
  token_type: 'bearer',
  user: {
    id: 'user-1',
    email: 'student@psu.edu',
    name: 'Student',
  },
}

// Renders a protected page next to a stand-in Login page.
function renderProtectedPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/"
          element={<div>Login Test Page</div>}
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <div>Protected Test Page</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Authentication Tests', () => {

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    delete window.google
  })

  // TEST 1: Pages require a login.
  test('redirects to Login when not logged in', () => {
    renderProtectedPage()

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Protected Test Page')
    ).not.toBeInTheDocument()
  })

  // TEST 2: Logged-in users can open pages.
  test('shows the page when logged in', () => {
    saveLogin(mockLogin)

    renderProtectedPage()

    expect(
      screen.getByText('Protected Test Page')
    ).toBeInTheDocument()
  })

  // TEST 3: Logging out leaves the page.
  test('returns to Login after logging out', () => {
    saveLogin(mockLogin)

    renderProtectedPage()

    act(() => {
      logout()
    })

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()

    expect(getToken()).toBeNull()
  })

  // TEST 4: Backend requests carry the login token.
  test('sends the login token with backend requests', async () => {
    saveLogin(mockLogin)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })

    vi.stubGlobal('fetch', mockFetch)

    await authFetch('/sessions', { method: 'POST' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      }
    )
  })

  // TEST 5: An expired login ends the session.
  test('returns to Login when the backend rejects the login', async () => {
    saveLogin(mockLogin)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })
    )

    renderProtectedPage()

    await act(async () => {
      await authFetch('/sessions', { method: 'POST' })
    })

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()

    expect(getToken()).toBeNull()
  })

  // TEST 6: Google sign-in sends Google's token to the backend.
  test('logs in with Google', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id')

    // Stand-in for Google Identity Services.
    let googleCallback = null

    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((options) => {
            googleCallback = options.callback
          }),
          renderButton: vi.fn(),
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLogin,
    })

    vi.stubGlobal('fetch', mockFetch)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={<div>Dashboard Test Page</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      screen.getByTestId('google-signin-button')
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        window.google.accounts.id.initialize
      ).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'test-client-id' })
      )
    })

    // Google calls back after the user picks an account.
    await act(async () => {
      googleCallback({ credential: 'google-id-token' })
    })

    expect(
      await screen.findByText('Dashboard Test Page')
    ).toBeInTheDocument()

    const [url, options] = mockFetch.mock.calls[0]

    expect(url).toBe('http://127.0.0.1:8000/auth/google')
    expect(JSON.parse(options.body)).toEqual({
      credential: 'google-id-token',
    })

    expect(getToken()).toBe('test-token')
  })

})
