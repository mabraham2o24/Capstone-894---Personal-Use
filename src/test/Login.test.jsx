
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import Login from '../pages/Login.jsx'

// Renders the Login page with routing enabled.
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={<div>Dashboard Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Login Page Tests', () => {

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

  // TEST 3: Verify navigation to Dashboard.
  // This tests frontend navigation, not real authentication.
  test('navigates to dashboard after clicking Login', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.click(
      screen.getByRole('button', {
        name: 'Login',
      })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
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

})
