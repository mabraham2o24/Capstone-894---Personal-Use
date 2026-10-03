
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from '../pages/Login.jsx'

describe('Login Page Tests', () => {

  // Test 1: Verify that the Login page displays correctly.
  test('displays the email and password fields', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  // Test 2: Verify that the Login button is displayed.
  test('displays the Login button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('button', { name: 'Login' })
    ).toBeInTheDocument()
  })

  // Test 3: Verify that clicking Login navigates to the dashboard.
  test('navigates to dashboard after clicking Login', async () => {
    const user = userEvent.setup()

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

    await user.click(
      screen.getByRole('button', { name: 'Login' })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

  // Test 4: Verify that the user can enter an email address.
  test('allows the user to enter an email address', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    const emailInput = screen.getByLabelText('Email')

    await user.type(emailInput, 'student@psu.edu')

    expect(emailInput).toHaveValue('student@psu.edu')
  })

  // Test 5: Verify that the user can enter a password.
  test('allows the user to enter a password', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    const passwordInput = screen.getByLabelText('Password')

    await user.type(passwordInput, 'TestPassword123')

    expect(passwordInput).toHaveValue('TestPassword123')
  })

})
