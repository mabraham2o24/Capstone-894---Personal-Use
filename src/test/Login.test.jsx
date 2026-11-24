

import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import Login from '../pages/Login.jsx'
import { getToken, getUser, saveLogin } from '../auth.js'

const mockLoginResponse = {
  access_token: 'test-token',
  token_type: 'bearer',
  user: {
    id: 'user-1',
    email: 'student@psu.edu',
    name: 'Student',
  },
}

// Renders the Login page with routing enabled.
function renderLogin(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={<div>Dashboard Test Page</div>}
        />

        <Route
          path="/practice"
          element={<div>Practice Test Page</div>}
        />

        <Route
          path="/signup"
          element={<div>Sign Up Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

// Mock the backend's response to a login request.
function mockLoginRequest(response) {
  const mockFetch = vi.fn().mockResolvedValue(response)

  vi.stubGlobal('fetch', mockFetch)

  return mockFetch
}

// Fill in the login form and click Login.
async function submitLogin(user, email, password) {
  if (email) {
    await user.type(screen.getByLabelText('Email'), email)
  }

  if (password) {
    await user.type(screen.getByLabelText('Password'), password)
  }

  await user.click(
    screen.getByRole('button', {
      name: 'Login',
    })
  )
}

describe('Login Page Tests', () => {

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // TEST 1: Verify that the Login page displays correctly.
  test('displays the email and password fields', () => {
    renderLogin()

    expect(
      screen.getByLabelText('Email')
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Password')
    ).toBeInTheDocument()
  })

  // TEST 2: Verify that the Login button is displayed.
  test('displays the Login button', () => {
    renderLogin()

    expect(
      screen.getByRole('button', {
        name: 'Login',
      })
    ).toBeInTheDocument()
  })

  // TEST 3: Verify a successful login opens the Dashboard.
  test('logs in and navigates to dashboard', async () => {
    const user = userEvent.setup()

    const mockFetch = mockLoginRequest({
      ok: true,
      json: async () => mockLoginResponse,
    })

    renderLogin()

    await submitLogin(user, 'student@psu.edu', 'TestPassword123')

    expect(
      await screen.findByText('Dashboard Test Page')
    ).toBeInTheDocument()

    const [url, options] = mockFetch.mock.calls[0]

    expect(url).toBe('http://127.0.0.1:8000/auth/login')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      email: 'student@psu.edu',
      password: 'TestPassword123',
    })

    // The login is kept for later requests.
    expect(getToken()).toBe('test-token')
    expect(getUser()).toEqual(mockLoginResponse.user)
  })

  // TEST 4: Verify that the user can enter an email address.
  test('allows the user to enter an email address', async () => {
    const user = userEvent.setup()

    renderLogin()

    const emailInput = screen.getByLabelText('Email')

    await user.type(emailInput, 'student@psu.edu')

    expect(emailInput).toHaveValue('student@psu.edu')
  })

  // TEST 5: Verify that the user can enter a password.
  test('allows the user to enter a password', async () => {
    const user = userEvent.setup()

    renderLogin()

    const passwordInput = screen.getByLabelText('Password')

    await user.type(passwordInput, 'TestPassword123')

    expect(passwordInput).toHaveValue('TestPassword123')
  })

  // TEST 6: Verify the backend's error is shown for a wrong password.
  test('shows an error for an incorrect password', async () => {
    const user = userEvent.setup()

    mockLoginRequest({
      ok: false,
      status: 401,
      json: async () => ({
        detail: 'Incorrect email or password.',
      }),
    })

    renderLogin()

    await submitLogin(user, 'student@psu.edu', 'WrongPassword')

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('Incorrect email or password.')

    expect(
      screen.queryByText('Dashboard Test Page')
    ).not.toBeInTheDocument()

    expect(getToken()).toBeNull()
  })

  // TEST 7: Verify empty fields are caught before contacting the backend.
  test('asks for email and password when fields are empty', async () => {
    const user = userEvent.setup()

    const mockFetch = mockLoginRequest({ ok: true })

    renderLogin()

    await submitLogin(user)

    expect(
      screen.getByRole('alert')
    ).toHaveTextContent('Enter your email and password.')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // TEST 8: Verify a connection problem is reported.
  test('shows an error when the backend cannot be reached', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    )

    renderLogin()

    await submitLogin(user, 'student@psu.edu', 'TestPassword123')

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('Failed to fetch')
  })

  // TEST 9: Verify the user returns to the page they tried to open.
  test('returns to the requested page after login', async () => {
    const user = userEvent.setup()

    mockLoginRequest({
      ok: true,
      json: async () => mockLoginResponse,
    })

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/', state: { from: { pathname: '/practice' } } },
        ]}
      >
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/practice"
            element={<div>Practice Test Page</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    await submitLogin(user, 'student@psu.edu', 'TestPassword123')

    expect(
      await screen.findByText('Practice Test Page')
    ).toBeInTheDocument()
  })

  // TEST 10: Verify a logged-in user skips the Login page.
  test('redirects a logged-in user to dashboard', () => {
    saveLogin(mockLoginResponse)

    renderLogin()

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

  // TEST 11: Verify the Sign Up link opens the Sign Up page.
  test('navigates to Sign Up', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.click(
      screen.getByRole('link', {
        name: 'Sign Up',
      })
    )

    expect(
      screen.getByText('Sign Up Test Page')
    ).toBeInTheDocument()
  })

  // TEST 12: The Google button is hidden until a client ID is set.
  test('hides Google sign-in when it is not configured', () => {
    renderLogin()

    expect(
      screen.queryByTestId('google-signin-button')
    ).not.toBeInTheDocument()
  })

})
