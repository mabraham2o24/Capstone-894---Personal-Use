import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import ScoreProcessing from '../pages/ScoreProcessing.jsx'

// Sample MusicXML results returned by the backend.
const mockScoreResult = {
  filename: 'sample.musicxml',
  status: 'processed',
  summary: {
    total_notes_detected: 4,
    num_measures: 1,
    tempo_bpm: 120,
    first_notes_preview: [
      {
        pitches: ['C4'],
        duration_quarterLength: 1,
        offset: 0,
      },
      {
        pitches: ['D4'],
        duration_quarterLength: 1,
        offset: 1,
      },
      {
        pitches: ['E4'],
        duration_quarterLength: 1,
        offset: 2,
      },
      {
        pitches: ['F4'],
        duration_quarterLength: 1,
        offset: 3,
      },
    ],
  },
}

// Displays data passed to the Performance Upload page.
function MockPerformanceUpload() {
  const location = useLocation()

  return (
    <div>
      <h1>Performance Upload Test Page</h1>
      <p>Session: {location.state?.sessionId}</p>
      <p>File: {location.state?.scoreResult?.filename}</p>
    </div>
  )
}

// Renders Score Processing with optional session data.
function renderScoreProcessing(state = null) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/score-processing',
          state,
        },
      ]}
    >
      <Routes>
        <Route
          path="/score-processing"
          element={<ScoreProcessing />}
        />
        <Route
          path="/performance-upload"
          element={<MockPerformanceUpload />}
        />
        <Route
          path="/practice"
          element={<div>Practice Session Test Page</div>}
        />
        <Route
          path="/dashboard"
          element={<div>Dashboard Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Score Processing Page Tests', () => {

  // Test 1: Verify the page displays processed score details.
  test('displays MusicXML processing summary', () => {
    renderScoreProcessing({
      sessionId: 123,
      scoreResult: mockScoreResult,
    })

    expect(
      screen.getByText('MusicXML score successfully processed.')
    ).toBeInTheDocument()

    expect(screen.getByText('123')).toBeInTheDocument()
    expect(
      screen.getByText('sample.musicxml')
    ).toBeInTheDocument()

    expect(screen.getByText('processed')).toBeInTheDocument()
    expect(screen.getByText('120 BPM')).toBeInTheDocument()

    // Check the number of notes and measures.
    expect(screen.getByText('Total Notes')).toBeInTheDocument()
    expect(screen.getByText('Measures')).toBeInTheDocument()

    const summary = document.querySelector('.summary-grid')

    expect(
      within(summary).getByText('4')
    ).toBeInTheDocument()

    expect(
      within(summary).getByText('1')
    ).toBeInTheDocument()
  })

  // Test 2: Verify extracted notes are displayed.
  test('displays extracted pitches, durations, and onsets', () => {
    renderScoreProcessing({
      sessionId: 123,
      scoreResult: mockScoreResult,
    })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')

    // Header row plus four extracted notes.
    expect(rows).toHaveLength(5)

    expect(
      within(table).getByText('C4')
    ).toBeInTheDocument()

    expect(
      within(table).getByText('D4')
    ).toBeInTheDocument()

    expect(
      within(table).getByText('E4')
    ).toBeInTheDocument()

    expect(
      within(table).getByText('F4')
    ).toBeInTheDocument()

    // Verify the first note's values.
    expect(
      within(rows[1]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['1', 'C4', '1', '0'])
  })

  // Test 3: Verify missing tempo is handled correctly.
  test('displays Not specified when tempo is missing', () => {
    const scoreWithoutTempo = {
      ...mockScoreResult,
      summary: {
        ...mockScoreResult.summary,
        tempo_bpm: null,
      },
    }

    renderScoreProcessing({
      sessionId: 123,
      scoreResult: scoreWithoutTempo,
    })

    expect(
      screen.getByText('Not specified')
    ).toBeInTheDocument()
  })

  // Test 4: Verify navigation to Performance Upload.
  test('navigates to Performance Upload with session data', async () => {
    const user = userEvent.setup()

    renderScoreProcessing({
      sessionId: 123,
      scoreResult: mockScoreResult,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      screen.getByText('Performance Upload Test Page')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Session: 123')
    ).toBeInTheDocument()

    expect(
      screen.getByText('File: sample.musicxml')
    ).toBeInTheDocument()
  })

  // Test 5: Verify missing session data is handled.
  test('displays a message when no score is available', () => {
    renderScoreProcessing()

    expect(
      screen.getByText(
        'No processed MusicXML score is available.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Start a Practice Session/i,
      })
    ).toBeInTheDocument()
  })

  // Test 6: Verify users can return to Practice Session
  // when no score data is available.
  test('navigates to Practice Session when data is missing', async () => {
    const user = userEvent.setup()

    renderScoreProcessing()

    await user.click(
      screen.getByRole('button', {
        name: /Start a Practice Session/i,
      })
    )

    expect(
      screen.getByText('Practice Session Test Page')
    ).toBeInTheDocument()
  })

  // Test 7: Verify Back to Dashboard navigation.
  test('navigates back to Dashboard', async () => {
    const user = userEvent.setup()

    renderScoreProcessing({
      sessionId: 123,
      scoreResult: mockScoreResult,
    })

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