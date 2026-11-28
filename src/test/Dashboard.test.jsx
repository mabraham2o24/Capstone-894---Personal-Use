import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom'

import Dashboard from '../pages/Dashboard.jsx'

import {
  saveLogin,
  getToken,
} from '../auth.js'

//* ============================================================
//* MOCK AUTHENTICATION DATA
//* ============================================================

const mockDashboardLogin = {
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
          path="/practice-history"
          element={<div>Practice History Test Page</div>}
        />

        <Route
          path="/"
          element={<div>Login Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

//* ============================================================
//* EXISTING DASHBOARD PAGE TESTS
//* ============================================================

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

//* ============================================================
//* US-20 - PRACTICE HISTORY DASHBOARD INTEGRATION
//* ============================================================

describe('US-20 - Dashboard Practice History Integration', () => {

  //* TEST 5: Verify that the View Practice History button appears.
  test('displays the View Practice History button', () => {
    renderDashboard()

    const historyButton = screen.getByRole('button', {
      name: /View Practice History/i,
    })

    expect(historyButton).toBeInTheDocument()

    expect(historyButton).toBeEnabled()
  })

  //* TEST 6: Verify navigation to the Practice History page.
  test('navigates to Practice History after clicking View Practice History', async () => {
    const user = userEvent.setup()

    renderDashboard()

    await user.click(
      screen.getByRole('button', {
        name: /View Practice History/i,
      })
    )

    expect(
      screen.getByText('Practice History Test Page')
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Make every practice session count.',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 7: Verify that both Dashboard navigation buttons remain available.
  test('displays both practice navigation buttons without affecting existing functionality', () => {
    renderDashboard()

    const practiceButton = screen.getByRole('button', {
      name: /Start Practice Session/i,
    })

    const historyButton = screen.getByRole('button', {
      name: /View Practice History/i,
    })

    expect(practiceButton).toBeInTheDocument()

    expect(historyButton).toBeInTheDocument()

    expect(practiceButton).toBeEnabled()

    expect(historyButton).toBeEnabled()

    expect(practiceButton).not.toBe(historyButton)
  })

  //* TEST 8: Verify that the existing Dashboard workflow remains visible.
  test('preserves the existing three-step practice workflow', () => {
    renderDashboard()

    expect(
      screen.getByRole('heading', {
        name: 'How It Works',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Three simple steps to review your performance.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: 'Upload Your Score',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: 'Select Your Measures',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: 'Review Your Feedback',
      })
    ).toBeInTheDocument()
  })

  //* TEST 9: Verify that Logout clears authentication and returns to Login.
  test('clears the authentication token and returns to Login after logout', async () => {
    const user = userEvent.setup()

    saveLogin(mockDashboardLogin)

    expect(getToken()).toBe('test-token')

    renderDashboard()

    expect(
      screen.getByRole('button', {
        name: /View Practice History/i,
      })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Logout/i,
      })
    )

    expect(getToken()).toBeNull()

    expect(
      screen.getByText('Login Test Page')
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: /View Practice History/i,
      })
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: /Start Practice Session/i,
      })
    ).not.toBeInTheDocument()
  })

})