import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import PerformanceResults from '../pages/PerformanceResults.jsx'

// Sample MusicXML information from the previous pages.
const mockScoreResult = {
  filename: 'sample.musicxml',
  status: 'processed',
}

// Sample audio-analysis results returned by FastAPI.
const mockAudioResult = {
  filename: 'performance.wav',
  status: 'processed',
  detected_pitches: ['C4', 'D4', 'E4'],
  note_events: [
    {
      pitch: 'C4',
      duration: 0.5,
      onset: 0,
    },
    {
      pitch: 'D4',
      duration: 0.6,
      onset: 0.5,
    },
    {
      pitch: 'E4',
      duration: 0.7,
      onset: 1.1,
    },
  ],
}

// Displays the information passed back to Performance Upload.
function MockPerformanceUpload() {
  const location = useLocation()

  return (
    <div>
      <h1>Performance Upload Test Page</h1>
      <p>Session: {location.state?.sessionId}</p>
      <p>Score: {location.state?.scoreResult?.filename}</p>
    </div>
  )
}

// Renders Performance Results with optional session data.
function renderPerformanceResults(state = null) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/performance-results',
          state,
        },
      ]}
    >
      <Routes>
        <Route
          path="/performance-results"
          element={<PerformanceResults />}
        />

        <Route
          path="/performance-upload"
          element={<MockPerformanceUpload />}
        />

        <Route
          path="/dashboard"
          element={<div>Dashboard Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Performance Results Page Tests', () => {

  // Test 1: Verify the audio-processing summary.
  test('displays audio-processing summary', () => {
    renderPerformanceResults({
      sessionId: 123,
      scoreResult: mockScoreResult,
      audioResult: mockAudioResult,
    })

    expect(
      screen.getByText('Audio successfully processed.')
    ).toBeInTheDocument()

    expect(
      screen.getByText('performance.wav')
    ).toBeInTheDocument()

    expect(
      screen.getByText('processed')
    ).toBeInTheDocument()

    const summary = document.querySelector('.summary-grid')

    expect(
      within(summary).getByText('123')
    ).toBeInTheDocument()

    // Three detected pitches and three note events.
    expect(
      within(summary).getAllByText('3')
    ).toHaveLength(2)
  })

  // Test 2: Verify detected pitches are displayed.
  test('displays detected pitches correctly', () => {
    renderPerformanceResults({
      sessionId: 123,
      scoreResult: mockScoreResult,
      audioResult: mockAudioResult,
    })

    expect(
      screen.getByText('C4, D4, E4')
    ).toBeInTheDocument()
  })

  // Test 3: Verify detected note events and timing.
  test('displays note events with duration and onset', () => {
    renderPerformanceResults({
      sessionId: 123,
      scoreResult: mockScoreResult,
      audioResult: mockAudioResult,
    })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')

    // One header row and three detected notes.
    expect(rows).toHaveLength(4)

    // Verify the first note's values.
    expect(
      within(rows[1]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['1', 'C4', '0.5 sec', '0 sec'])

    // Verify the second note's values.
    expect(
      within(rows[2]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['2', 'D4', '0.6 sec', '0.5 sec'])

    // Verify the third note's values.
    expect(
      within(rows[3]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['3', 'E4', '0.7 sec', '1.1 sec'])
  })

  // Test 4: Verify an empty note-event list.
  test('handles a performance with no detected notes', () => {
    const emptyAudioResult = {
      ...mockAudioResult,
      detected_pitches: [],
      note_events: [],
    }

    renderPerformanceResults({
      sessionId: 123,
      scoreResult: mockScoreResult,
      audioResult: emptyAudioResult,
    })

    const summary = document.querySelector('.summary-grid')

    expect(
      within(summary).getAllByText('0')
    ).toHaveLength(2)

    // Only the header row should appear.
    expect(
      within(screen.getByRole('table')).getAllByRole('row')
    ).toHaveLength(1)
  })

  // Test 5: Verify missing performance data is handled.
  test('displays a message when no performance is available', () => {
    renderPerformanceResults()

    expect(
      screen.getByText(
        'No processed performance is available.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Back to Dashboard/i,
      })
    ).toBeInTheDocument()
  })

  // Test 6: Verify navigation to Performance Upload.
  test('returns to Performance Upload with session data', async () => {
    const user = userEvent.setup()

    renderPerformanceResults({
      sessionId: 123,
      scoreResult: mockScoreResult,
      audioResult: mockAudioResult,
    })

    await user.click(
      screen.getByRole('button', {
        name: /Back to Performance Upload/i,
      })
    )

    expect(
      screen.getByText('Performance Upload Test Page')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Session: 123')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Score: sample.musicxml')
    ).toBeInTheDocument()
  })

  // Test 7: Verify navigation to Dashboard.
  test('returns to Dashboard', async () => {
    const user = userEvent.setup()

    renderPerformanceResults({
      sessionId: 123,
      scoreResult: mockScoreResult,
      audioResult: mockAudioResult,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Back to Dashboard',
      })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

  // Test 8: Verify Dashboard navigation when
  // performance information is missing.
  test('returns to Dashboard when data is missing', async () => {
    const user = userEvent.setup()

    renderPerformanceResults()

    await user.click(
      screen.getByRole('button', {
        name: /Back to Dashboard/i,
      })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

})