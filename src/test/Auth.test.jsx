import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import RequireAuth from '../components/RequireAuth.jsx'
import Login from '../pages/Login.jsx'
import App from '../App.jsx'

import {
  authFetch,
  getToken,
  logout,
  saveLogin,
} from '../auth.js'

//* ============================================================
//* MOCK AUTHENTICATION DATA
//* ============================================================

const mockLogin = {
  access_token: 'test-token',
  token_type: 'bearer',
  user: {
    id: 'user-1',
    email: 'student@psu.edu',
    name: 'Student',
  },
}

//* ============================================================
//* TEST SETUP AND HELPER FUNCTIONS
//* ============================================================

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

//* Renders the actual application at a specified route.
function renderApplication(initialRoute) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

//* Creates a successful empty practice history response.
function mockEmptyPracticeHistory() {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
  })

  vi.stubGlobal('fetch', mockFetch)

  return mockFetch
}

//* ============================================================
//* EXISTING AUTHENTICATION TESTS
//* ============================================================

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

//* ============================================================
//* US-20 - PRACTICE HISTORY AUTHENTICATION AND ROUTING
//* ============================================================

describe('US-20 - Practice History Authentication and Routing', () => {

  //* Restore mocked globals and environment variables.
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    delete window.google
  })

  //* TEST 7: Verify that unauthenticated users cannot access Practice History.
  test('redirects unauthenticated users from Practice History to Login', async () => {
    localStorage.clear()

    const mockFetch = mockEmptyPracticeHistory()

    renderApplication('/practice-history')

    expect(
      await screen.findByRole('button', {
        name: /^(log\s*in|sign\s*in)$/i,
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Practice History',
        exact: true,
      })
    ).not.toBeInTheDocument()

    expect(getToken()).toBeNull()

    //* The protected page should not request practice history.
    expect(
      mockFetch.mock.calls.filter(([url]) =>
        String(url).endsWith('/sessions')
      )
    ).toHaveLength(0)
  })

  //* TEST 8: Verify that authenticated users can access Practice History.
  test('allows authenticated users to access the Practice History route', async () => {
    saveLogin(mockLogin)

    mockEmptyPracticeHistory()

    renderApplication('/practice-history')

    expect(
      await screen.findByRole('heading', {
        name: 'Practice History',
        exact: true,
      })
    ).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', {
        name: 'No Practice Sessions Yet',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Back to Dashboard',
      })
    ).toBeInTheDocument()

    expect(getToken()).toBe('test-token')
  })

  //* TEST 9: Verify that Practice History requests carry authentication.
  test('includes the authentication token when retrieving practice history through the protected route', async () => {
    vi.stubEnv(
      'VITE_API_URL',
      'http://127.0.0.1:8000'
    )

    saveLogin(mockLogin)

    const mockFetch = mockEmptyPracticeHistory()

    renderApplication('/practice-history')

    expect(
      await screen.findByRole('heading', {
        name: 'No Practice Sessions Yet',
      })
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
        signal: expect.any(AbortSignal),
      })
    )

    expect(
      mockFetch.mock.calls.filter(([url]) =>
        String(url).endsWith('/sessions')
      )
    ).toHaveLength(1)
  })

  //* TEST 10: Verify that logging out removes access to Practice History.
  test('redirects to Login when authentication is removed while viewing Practice History', async () => {
    saveLogin(mockLogin)

    mockEmptyPracticeHistory()

    renderApplication('/practice-history')

    expect(
      await screen.findByRole('heading', {
        name: 'No Practice Sessions Yet',
      })
    ).toBeInTheDocument()

    expect(getToken()).toBe('test-token')

    act(() => {
      logout()
    })

    expect(
      await screen.findByRole('button', {
        name: /^(log\s*in|sign\s*in)$/i,
      })
    ).toBeInTheDocument()

    expect(getToken()).toBeNull()

    expect(
      screen.queryByRole('heading', {
        name: 'Practice History',
        exact: true,
      })
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'No Practice Sessions Yet',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 11: Verify expired authentication handling in Practice History.
  test('redirects to Login when the backend rejects the Practice History authentication token', async () => {
    vi.stubEnv(
      'VITE_API_URL',
      'http://127.0.0.1:8000'
    )

    saveLogin(mockLogin)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        detail: 'Invalid or expired authentication token',
      }),
    })

    vi.stubGlobal('fetch', mockFetch)

    renderApplication('/practice-history')

    expect(
      await screen.findByRole('button', {
        name: /^(log\s*in|sign\s*in)$/i,
      })
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )

    expect(getToken()).toBeNull()

    expect(
      screen.queryByRole('heading', {
        name: 'Practice History',
        exact: true,
      })
    ).not.toBeInTheDocument()
  })

})