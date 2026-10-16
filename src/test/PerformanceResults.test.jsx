
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

// Sample Sprint 2 note-level feedback.
// These values represent the structure returned by FastAPI.
const mockNoteFeedback = [
  {
    measure: 3,
    beat: 1,
    expected_note: 'C5',
    played_note: 'C5',
    pitch_status: 'correct',
    expected_note_length: 'quarter note',
    played_note_length: 'quarter note',
    duration_status: 'correct',
    timing_status: 'on_time',
  },
  {
    measure: 3,
    beat: 2,
    expected_note: 'D5',
    played_note: 'C5',
    pitch_status: 'incorrect',
    expected_note_length: 'quarter note',
    played_note_length: 'quarter note',
    duration_status: 'correct',
    timing_status: 'late',
  },
  {
    measure: 3,
    beat: 3,
    expected_note: 'E5',
    played_note: null,
    pitch_status: 'missing',
    expected_note_length: 'quarter note',
    played_note_length: null,
    duration_status: null,
    timing_status: null,
  },
  {
    measure: 3,
    beat: 3.5,
    expected_note: null,
    played_note: 'F5',
    pitch_status: 'additional',
    expected_note_length: null,
    played_note_length: null,
    duration_status: null,
    timing_status: null,
  },
  {
    measure: 4,
    beat: 1,
    expected_note: 'G4',
    played_note: 'G4',
    pitch_status: 'correct',
    expected_note_length: 'quarter note',
    played_note_length: 'eighth note',
    duration_status: 'too_short',
    timing_status: 'early',
  },
  {
    measure: 4,
    beat: 2,
    expected_note: 'A4',
    played_note: 'A4',
    pitch_status: 'correct',
    expected_note_length: 'quarter note',
    played_note_length: 'half note',
    duration_status: 'too_long',
    timing_status: 'on_time',
  },
]

// Displays the information passed back to Performance Upload.
function MockPerformanceUpload() {
  const location = useLocation()

  return (
    <div>
      <h1>Performance Upload Test Page</h1>
      <p>Session: {location.state?.sessionId}</p>
      <p>Score: {location.state?.scoreResult?.filename}</p>
      <p>Start: {location.state?.startMeasure}</p>
      <p>End: {location.state?.endMeasure}</p>
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

// Returns the standard valid session information.
function createValidSession(audioResult = mockAudioResult) {
  return {
    sessionId: 123,
    scoreResult: mockScoreResult,
    audioResult,
    startMeasure: 3,
    endMeasure: 6,
  }
}

// Returns an audio result containing Sprint 2 feedback.
function createFeedbackSession() {
  return createValidSession({
    ...mockAudioResult,
    status: 'audio_analyzed',
    note_feedback: mockNoteFeedback,
  })
}

// Gets the feedback table separately from the detected-notes table.
function getFeedbackTable() {
  const tables = screen.getAllByRole('table')
  return tables[0]
}

describe('Performance Results Page Tests', () => {

  // Test 1: Verify the audio-processing summary.
  test('displays audio-processing summary', () => {
    renderPerformanceResults(createValidSession())

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

    // Three detected pitches, three note events,
    // and starting measure 3.
    expect(
      within(summary).getAllByText('3')
    ).toHaveLength(3)
  })

  // Test 2: Verify detected pitches are displayed.
  test('displays detected pitches correctly', () => {
    renderPerformanceResults(createValidSession())

    expect(
      screen.getByText('C4, D4, E4')
    ).toBeInTheDocument()
  })

  // Test 3: Verify detected note events and timing.
  test('displays note events with duration and onset', () => {
    renderPerformanceResults(createValidSession())

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')

    expect(rows).toHaveLength(4)

    expect(
      within(rows[1]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['1', 'C4', '0.5 sec', '0 sec'])

    expect(
      within(rows[2]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['2', 'D4', '0.6 sec', '0.5 sec'])

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

    renderPerformanceResults(
      createValidSession(emptyAudioResult)
    )

    const summary = document.querySelector('.summary-grid')

    expect(
      within(summary).getAllByText('0')
    ).toHaveLength(2)

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
  test('returns to Performance Upload with session and measures', async () => {
    const user = userEvent.setup()

    renderPerformanceResults(createValidSession())

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

    expect(
      screen.getByText('Start: 3')
    ).toBeInTheDocument()

    expect(
      screen.getByText('End: 6')
    ).toBeInTheDocument()
  })

  // Test 7: Verify navigation to Dashboard.
  test('returns to Dashboard', async () => {
    const user = userEvent.setup()

    renderPerformanceResults(createValidSession())

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

  // Test 9: Verify the selected measure range is displayed.
  test('displays selected starting and ending measures', () => {
    renderPerformanceResults(createValidSession())

    const summary = document.querySelector('.summary-grid')

    expect(
      within(summary).getByText('Starting Measure')
    ).toBeInTheDocument()

    expect(
      within(summary).getByText('Ending Measure')
    ).toBeInTheDocument()

    expect(
      within(summary).getByText('6')
    ).toBeInTheDocument()
  })

  // Test 10: Verify score-to-performance alignment feedback.
  test('displays expected and played notes with measure and beat', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(rows).toHaveLength(7)

    expect(
      within(rows[1]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      '3',
      '1',
      'C5',
      'C5',
      'correct',
      'quarter note',
      'quarter note',
      'correct',
      'on time',
    ])
  })

  // Test 11: Verify incorrect pitch feedback.
  test('displays incorrect pitch feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[2]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      '3',
      '2',
      'D5',
      'C5',
      'incorrect',
      'quarter note',
      'quarter note',
      'correct',
      'late',
    ])
  })

  // Test 12: Verify missing-note feedback.
  test('displays missing note feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[3]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      '3',
      '3',
      'E5',
      'N/A',
      'missing',
      'quarter note',
      'N/A',
      'Not available',
      'Not available',
    ])
  })

  // Test 13: Verify additional-note feedback.
  test('displays additional note feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[4]).getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      '3',
      '3.5',
      'N/A',
      'F5',
      'additional',
      'N/A',
      'N/A',
      'Not available',
      'Not available',
    ])
  })

  // Test 14: Verify early and late timing feedback.
  test('displays early and late timing feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[2]).getByText('late')
    ).toBeInTheDocument()

    expect(
      within(rows[5]).getByText('early')
    ).toBeInTheDocument()
  })

  // Test 15: Verify note-duration classifications.
  test('displays too short and too long duration feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[5]).getByText('too short')
    ).toBeInTheDocument()

    expect(
      within(rows[6]).getByText('too long')
    ).toBeInTheDocument()
  })

})
