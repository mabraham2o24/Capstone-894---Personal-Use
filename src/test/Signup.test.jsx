import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import Signup from '../pages/Signup.jsx'
import { getToken, saveLogin } from '../auth.js'

const mockSignupResponse = {
  access_token: 'new-account-token',
  token_type: 'bearer',
  user: {
    id: 'user-2',
    email: 'newstudent@psu.edu',
    name: 'New Student',
  },
}

// Renders the Sign Up page with routing enabled.
function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/"
          element={<div>Login Test Page</div>}
        />

        <Route
          path="/dashboard"
          element={<div>Dashboard Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

// Fill in the sign-up form and submit it.
async function submitSignup(
  user,
  {
    name = 'New Student',
    email = 'newstudent@psu.edu',
    password = 'TestPassword123',
    confirmPassword = password,
  } = {}
) {
  if (name) {
    await user.type(screen.getByLabelText('Name'), name)
  }

  if (email) {
    await user.type(screen.getByLabelText('Email'), email)
  }

  if (password) {
    await user.type(screen.getByLabelText('Password'), password)
  }

  if (confirmPassword) {
    await user.type(
      screen.getByLabelText('Confirm Password'),
      confirmPassword
    )
  }

  await user.click(
    screen.getByRole('button', {
      name: 'Sign Up',
    })
  )
}

describe('Sign Up Page Tests', () => {

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // TEST 1: Verify the sign-up form fields are displayed.
  test('displays the sign-up fields', () => {
    renderSignup()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Confirm Password')
    ).toBeInTheDocument()
  })

  // TEST 2: Verify a new account is created and logged in.
  test('creates an account and navigates to dashboard', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockSignupResponse,
    })

    vi.stubGlobal('fetch', mockFetch)

    renderSignup()

    await submitSignup(user)

    expect(
      await screen.findByText('Dashboard Test Page')
    ).toBeInTheDocument()

    const [url, options] = mockFetch.mock.calls[0]

    expect(url).toBe('http://127.0.0.1:8000/auth/signup')
    expect(JSON.parse(options.body)).toEqual({
      name: 'New Student',
      email: 'newstudent@psu.edu',
      password: 'TestPassword123',
    })

    expect(getToken()).toBe('new-account-token')
  })

  // TEST 3: Verify mismatched passwords are caught.
  test('shows an error when passwords do not match', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    renderSignup()

    await submitSignup(user, {
      password: 'TestPassword123',
      confirmPassword: 'DifferentPassword',
    })

    expect(
      screen.getByRole('alert')
    ).toHaveTextContent('Passwords do not match.')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // TEST 4: Verify a short password is caught.
  test('shows an error for a short password', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    renderSignup()

    await submitSignup(user, { password: 'short' })

    expect(
      screen.getByRole('alert')
    ).toHaveTextContent('Password must be at least 8 characters.')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // TEST 5: Verify the backend's error is shown for an existing email.
  test('shows an error when the email is already registered', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          detail: 'An account with this email already exists.',
        }),
      })
    )

    renderSignup()

    await submitSignup(user)

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('An account with this email already exists.')

    expect(getToken()).toBeNull()
  })

  // TEST 6: Verify the Login link returns to the Login page.
  test('navigates to Login', async () => {
    const user = userEvent.setup()

    renderSignup()

    await user.click(
      screen.getByRole('link', {
        name: 'Login',
      })
    )

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()
  })

  // TEST 7: Verify a logged-in user skips the Sign Up page.
  test('redirects a logged-in user to dashboard', () => {
    saveLogin(mockSignupResponse)

    renderSignup()

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

})
