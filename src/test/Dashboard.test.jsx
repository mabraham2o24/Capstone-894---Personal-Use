
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import Dashboard from '../pages/Dashboard.jsx'

// Renders the Dashboard with routing enabled.
function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/practice"
          element={<div>Practice Session Test Page</div>}
        />

        <Route
          path="/"
          element={<div>Login Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Dashboard Page Tests', () => {

  // TEST 1: Verify that the redesigned Dashboard displays correctly.
  test('displays the welcome message', () => {
    renderDashboard()

    expect(
      screen.getByRole('heading', {
        name: 'Make every practice session count.',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: 'Virtual Music Instructor',
      })
    ).toBeInTheDocument()
  })

  // TEST 2: Verify that the Start Practice Session button appears.
  test('displays the Start Practice Session button', () => {
    renderDashboard()

    expect(
      screen.getByRole('button', {
        name: /Start Practice Session/i,
      })
    ).toBeInTheDocument()
  })

  // TEST 3: Verify navigation to Practice Session.
  test('navigates to Practice Session', async () => {
    const user = userEvent.setup()

    renderDashboard()

    await user.click(
      screen.getByRole('button', {
        name: /Start Practice Session/i,
      })
    )

    expect(
      screen.getByText('Practice Session Test Page')
    ).toBeInTheDocument()
  })

  // TEST 4: Verify Logout navigation.
  // This tests navigation only, not real authentication.
  test('navigates to Login after clicking Logout', async () => {
    const user = userEvent.setup()

    renderDashboard()

    await user.click(
      screen.getByRole('button', {
        name: /Logout/i,
      })
    )

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()
  })

})
