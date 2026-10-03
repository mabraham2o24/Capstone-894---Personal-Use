import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Dashboard from '../pages/Dashboard.jsx'

describe('Dashboard Page Tests', () => {

  // Test 1: Verify that the Dashboard displays correctly.
  test('displays the welcome message', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('heading', { name: 'Welcome' })
    ).toBeInTheDocument()
  })

  // Test 2: Verify that clicking Start Practice Session
  // navigates to the Practice Session page.
  test('navigates to Practice Session', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/practice"
            element={<div>Practice Session Test Page</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Start Practice Session',
      })
    )

    expect(
      screen.getByText('Practice Session Test Page')
    ).toBeInTheDocument()
  })

  // Test 3: Verify that clicking Logout returns to Login.
  // This tests navigation only, not real authentication.
  test('navigates to Login after clicking Logout', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/"
            element={<div>Login Test Page</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    await user.click(
      screen.getByRole('button', { name: 'Logout' })
    )

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()
  })

})