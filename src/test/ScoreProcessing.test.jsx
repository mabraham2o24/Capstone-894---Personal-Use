
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
      <p>Start: {location.state?.startMeasure}</p>
      <p>End: {location.state?.endMeasure}</p>
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

// Creates a processed score with a specified number of measures.
function createScoreWithMeasures(numMeasures) {
  return {
    ...mockScoreResult,
    summary: {
      ...mockScoreResult.summary,
      num_measures: numMeasures,
    },
  }
}

// Standard session information for testing.
function createValidSession(scoreResult = mockScoreResult) {
  return {
    sessionId: 123,
    scoreResult,
  }
}

// Gets the redesigned Session Overview section.
function getSessionOverview() {
  return document.querySelector('.score-session-overview')
}

// Gets the Extracted Notes table.
function getNotesTable() {
  return document.querySelector('.score-notes-table')
}

// Gets the measure selection section.
function getMeasureSelection() {
  return document.querySelector('.score-measure-selection-section')
}

describe('Score Processing Page Tests', () => {

  // TEST 1: Verify the redesigned score-processing summary.
  test('displays MusicXML processing summary', () => {
    renderScoreProcessing(createValidSession())

    expect(
      screen.getByText(/MusicXML score successfully processed/i)
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: 'Score Results',
      })
    ).toBeInTheDocument()

    const overview = getSessionOverview()

    expect(
      within(overview).getByText('Score Uploaded')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('123')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('sample.musicxml')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('120 BPM')
    ).toBeInTheDocument()

    const stats = overview.querySelectorAll(
      '.score-session-stat-card'
    )

    expect(stats).toHaveLength(3)

    expect(
      within(stats[0]).getByText('Total Notes')
    ).toBeInTheDocument()

    expect(
      within(stats[0]).getByText('4')
    ).toBeInTheDocument()

    expect(
      within(stats[1]).getByText('Measures')
    ).toBeInTheDocument()

    expect(
      within(stats[1]).getByText('1')
    ).toBeInTheDocument()
  })

  // TEST 2: Verify extracted notes, pitches, durations, and onsets.
  test('displays extracted pitches, durations, and onsets', () => {
    renderScoreProcessing(createValidSession())

    const table = getNotesTable()
    const rows = within(table).getAllByRole('row')

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

    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['1', 'C4', '1', '0'])
  })

  // TEST 3: Verify missing tempo.
  test('displays Not specified when tempo is missing', () => {
    const scoreWithoutTempo = {
      ...mockScoreResult,
      summary: {
        ...mockScoreResult.summary,
        tempo_bpm: null,
      },
    }

    renderScoreProcessing(createValidSession(scoreWithoutTempo))

    expect(
      screen.getByText('Not specified')
    ).toBeInTheDocument()
  })

  // TEST 4: Verify navigation with the selected measure range.
  test('navigates to Performance Upload with session and measures', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    await user.type(
      screen.getByLabelText(/Starting Measure/i),
      '3'
    )

    await user.type(
      screen.getByLabelText(/Ending Measure/i),
      '6'
    )

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

    expect(
      screen.getByText('Start: 3')
    ).toBeInTheDocument()

    expect(
      screen.getByText('End: 6')
    ).toBeInTheDocument()
  })

  // TEST 5: Verify missing session data.
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

  // TEST 6: Verify navigation to Practice Session.
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

  // TEST 7: Verify navigation to Dashboard.
  test('navigates back to Dashboard', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(createValidSession())

    await user.click(
      screen.getByRole('button', {
        name: /Back to Dashboard/i,
      })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

  // TEST 8: Verify measures are required.
  test('requires starting and ending measures', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      screen.getByText(
        'Please enter both starting and ending measures.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Performance Upload Test Page')
    ).not.toBeInTheDocument()
  })

  // TEST 9: Verify reversed measure ranges are rejected.
  test('rejects an ending measure before the starting measure', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    await user.type(
      screen.getByLabelText(/Starting Measure/i),
      '6'
    )

    await user.type(
      screen.getByLabelText(/Ending Measure/i),
      '3'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      screen.getByText(
        'Starting measure cannot be greater than ending measure.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Performance Upload Test Page')
    ).not.toBeInTheDocument()
  })

  // TEST 10: Verify ranges beyond the score are rejected.
  test('rejects a measure range beyond the score', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    await user.type(
      screen.getByLabelText(/Starting Measure/i),
      '3'
    )

    await user.type(
      screen.getByLabelText(/Ending Measure/i),
      '10'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      screen.getByText('Ending measure cannot exceed 8.')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Performance Upload Test Page')
    ).not.toBeInTheDocument()
  })

  // TEST 11: Verify redesigned Session Overview cards.
  test('displays the correct session information cards', () => {
    renderScoreProcessing(createValidSession())

    const overview = getSessionOverview()

    const infoCards = overview.querySelectorAll(
      '.score-session-info-card'
    )

    expect(infoCards).toHaveLength(2)

    expect(
      within(infoCards[0]).getByText('MusicXML File')
    ).toBeInTheDocument()

    expect(
      within(infoCards[0]).getByText('sample.musicxml')
    ).toBeInTheDocument()

    expect(
      within(infoCards[1]).getByText('Session ID')
    ).toBeInTheDocument()

    expect(
      within(infoCards[1]).getByText('123')
    ).toBeInTheDocument()
  })

  // TEST 12: Verify the extracted note count.
  test('displays the number of extracted preview notes', () => {
    renderScoreProcessing(createValidSession())

    expect(
      screen.getByText('4 Displayed')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Score Note Data')
    ).toBeInTheDocument()
  })

  // TEST 13: Verify pitch badges.
  test('displays extracted pitches as individual badges', () => {
    renderScoreProcessing(createValidSession())

    const badges = document.querySelectorAll(
      '.score-note-pitch-badge'
    )

    expect(badges).toHaveLength(4)

    expect(
      Array.from(badges).map((badge) => badge.textContent)
    ).toEqual(['C4', 'D4', 'E4', 'F4'])
  })

  // TEST 14: Verify empty extracted notes.
  test('handles an empty extracted note preview', () => {
    const scoreWithoutNotes = {
      ...mockScoreResult,
      summary: {
        ...mockScoreResult.summary,
        first_notes_preview: [],
      },
    }

    renderScoreProcessing(createValidSession(scoreWithoutNotes))

    expect(
      screen.getByText('0 Displayed')
    ).toBeInTheDocument()

    expect(
      screen.getByText('No extracted note preview is available.')
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('table')
    ).not.toBeInTheDocument()
  })

  // TEST 15: Verify multiple pitches in one note.
  test('displays multiple pitches for a chord', () => {
    const scoreWithChord = {
      ...mockScoreResult,
      summary: {
        ...mockScoreResult.summary,
        first_notes_preview: [
          {
            pitches: ['C4', 'E4', 'G4'],
            duration_quarterLength: 1,
            offset: 0,
          },
        ],
      },
    }

    renderScoreProcessing(createValidSession(scoreWithChord))

    const badges = document.querySelectorAll(
      '.score-note-pitch-badge'
    )

    expect(badges).toHaveLength(3)

    expect(
      Array.from(badges).map((badge) => badge.textContent)
    ).toEqual(['C4', 'E4', 'G4'])
  })

  // TEST 16: Verify available measure count.
  test('displays the number of available measures', () => {
    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    const selection = getMeasureSelection()

    expect(
      within(selection).getByText('8 Measures Available')
    ).toBeInTheDocument()
  })

  // TEST 17: Verify the live selected range preview.
  test('updates the selected practice range as measures are entered', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    const range = document.querySelector(
      '.score-selected-range'
    )

    expect(
      within(range).getByText('—')
    ).toBeInTheDocument()

    await user.type(
      screen.getByLabelText(/Starting Measure/i),
      '3'
    )

    await user.type(
      screen.getByLabelText(/Ending Measure/i),
      '6'
    )

    expect(
      within(range).getByText('3 – 6')
    ).toBeInTheDocument()
  })

  // TEST 18: Verify invalid zero measures.
  test('rejects a starting measure of zero', async () => {
    const user = userEvent.setup()

    renderScoreProcessing(
      createValidSession(createScoreWithMeasures(8))
    )

    await user.type(
      screen.getByLabelText(/Starting Measure/i),
      '0'
    )

    await user.type(
      screen.getByLabelText(/Ending Measure/i),
      '3'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      screen.getByText(
        'Please enter valid whole-number measures.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Performance Upload Test Page')
    ).not.toBeInTheDocument()
  })

})
