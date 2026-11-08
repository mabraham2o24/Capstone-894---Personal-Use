
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
    { pitch: 'C4', duration: 0.5, onset: 0 },
    { pitch: 'D4', duration: 0.6, onset: 0.5 },
    { pitch: 'E4', duration: 0.7, onset: 1.1 },
  ],
}

// Sample Sprint 2 note-level feedback.
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

// Sample Sprint 3 performance summary.
// Percentages are already on the 0-100 scale.
// Problem-area error rates are on the 0-1 scale.
const mockPerformanceSummary = {
  metrics: {
    pitch_accuracy: {
      accuracy_percent: 93.75,
      correct_notes: 15,
      total_expected_notes: 16,
    },
    rhythmic_accuracy: {
      accuracy_percent: 92.19,
      onset_accuracy_percent: 94.5,
      duration_accuracy_percent: 89.88,
    },
    tempo_consistency: {
      consistency_percent: 90.17,
      variation_percent: 9.83,
    },
    note_sequence_accuracy: {
      accuracy_percent: 87.5,
      correct_notes: 14,
      total_expected_notes: 16,
    },
  },
  error_counts: {
    incorrect_pitch: 1,
    missing_notes: 1,
    additional_notes: 1,
  },
  problem_areas: [
    {
      measure: 4,
      total_notes: 4,
      error_notes: 2,
      error_rate: 0.5,
      requires_practice: true,
      error_types: {
        timing: 2,
        duration: 1,
        missing: 1,
      },
      error_locations: [
        {
          beat: 2,
          expected_note: 'A4',
          played_note: null,
          errors: ['missing'],
        },
        {
          beat: 4,
          expected_note: 'C#5',
          played_note: 'C5',
          errors: ['timing', 'duration'],
        },
      ],
    },
    {
      measure: 5,
      total_notes: 4,
      error_notes: 1,
      error_rate: 0.25,
      requires_practice: false,
      error_types: {
        incorrect_pitch: 1,
      },
      error_locations: [
        {
          beat: 3,
          expected_note: 'D5',
          played_note: 'C5',
          errors: ['incorrect_pitch'],
        },
      ],
    },
  ],
}

// Mock page for testing navigation back to Performance Upload.
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

// Render Performance Results with optional session data.
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

// Standard valid session information.
function createValidSession(audioResult = mockAudioResult) {
  return {
    sessionId: 123,
    scoreResult: mockScoreResult,
    audioResult,
    startMeasure: 3,
    endMeasure: 6,
  }
}

// Session with Sprint 2 note-level feedback.
function createFeedbackSession() {
  return createValidSession({
    ...mockAudioResult,
    status: 'audio_analyzed',
    note_feedback: mockNoteFeedback,
  })
}

// Session with all Sprint 3 results.
function createSprint3Session() {
  return createValidSession({
    ...mockAudioResult,
    status: 'audio_analyzed',
    note_feedback: mockNoteFeedback,
    performance_summary: mockPerformanceSummary,
  })
}

// Session with insufficient audio data for UAT-06.
function createInsufficientAudioSession() {
  return createValidSession({
    filename: 'canon_measures_3_6_insufficient_data.wav',
    status: 'audio_analyzed',
    detected_pitches: ['F#5'],
    note_events: [],
    note_feedback: [],
    performance_summary: null,
  })
}

// Session with successful analysis and no problem areas.
function createNoProblemAreasSession() {
  return createValidSession({
    ...mockAudioResult,
    status: 'audio_analyzed',
    performance_summary: {
      ...mockPerformanceSummary,
      problem_areas: [],
    },
  })
}

// Get the Performance Feedback table.
function getFeedbackTable() {
  const heading = screen.getByRole('heading', {
    name: 'Performance Feedback',
  })

  const column = heading.closest('.performance-results-column')

  return within(column).getByRole('table')
}

// Get the Performance Summary metric cards.
function getMetricCard(label) {
  const summary = document.querySelector(
    '.performance-results-layout .summary-grid'
  )

  const labelElement = within(summary).getByText(label)

  return labelElement.parentElement
}

// Get a problem-area overview card for a specific measure.
function getProblemCard(measure) {
  const cards = document.querySelectorAll(
    '.performance-problem-card'
  )

  return Array.from(cards).find((card) =>
    within(card).queryByRole('heading', {
      name: `Measure ${measure}`,
    })
  )
}

// Get the error-location card for a specific measure.
function getErrorLocationCard(measure) {
  const cards = document.querySelectorAll(
    '.error-location-measure-card'
  )

  return Array.from(cards).find((card) =>
    within(card).queryByRole('heading', {
      name: `Measure ${measure}`,
    })
  )
}

describe('Performance Results Page Tests', () => {

  // TEST 1: Verify the redesigned audio-processing summary.
  test('displays audio-processing summary', () => {
    renderPerformanceResults(createSprint3Session())

    expect(
      screen.getByText(/Audio successfully processed/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText('performance.wav')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Analysis Complete')
    ).toBeInTheDocument()

    const overview = document.querySelector(
      '.performance-session-overview'
    )

    expect(
      within(overview).getByText('123')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('3–6')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('Detected Pitches')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('Note Events')
    ).toBeInTheDocument()
  })

  // TEST 2: Verify individual detected pitch badges.
  test('displays detected pitches correctly', () => {
    renderPerformanceResults(createValidSession())

    const pitchList = document.querySelector(
      '.performance-pitch-list'
    )

    const badges = pitchList.querySelectorAll(
      '.performance-pitch-badge'
    )

    expect(badges).toHaveLength(3)

    expect(
      Array.from(badges).map((badge) => badge.textContent)
    ).toEqual(['C4', 'D4', 'E4'])

    expect(
      screen.getByText('3 Detected')
    ).toBeInTheDocument()
  })

  // TEST 3: Verify note-event counts.
  test('displays detected note-event count', () => {
    renderPerformanceResults(createValidSession())

    const overview = document.querySelector(
      '.performance-session-overview'
    )

    const cards = overview.querySelectorAll(
      '.performance-session-stat-card'
    )

    expect(cards).toHaveLength(3)

    expect(
      within(cards[1]).getByText('3')
    ).toBeInTheDocument()

    expect(
      within(cards[2]).getByText('3')
    ).toBeInTheDocument()
  })

  // TEST 4: Verify empty detected pitches and note events.
  test('handles a performance with no detected notes', () => {
    const emptyAudioResult = {
      ...mockAudioResult,
      detected_pitches: [],
      note_events: [],
    }

    renderPerformanceResults(
      createValidSession(emptyAudioResult)
    )

    expect(
      screen.getByText('No pitches detected.')
    ).toBeInTheDocument()

    expect(
      screen.getByText('0 Detected')
    ).toBeInTheDocument()

    const cards = document.querySelectorAll(
      '.performance-session-stat-card'
    )

    expect(
      within(cards[1]).getByText('0')
    ).toBeInTheDocument()

    expect(
      within(cards[2]).getByText('0')
    ).toBeInTheDocument()
  })

  // TEST 5: Verify missing performance data.
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

  // TEST 6: Verify navigation to Performance Upload.
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

  // TEST 7: Verify navigation to Dashboard.
  test('returns to Dashboard', async () => {
    const user = userEvent.setup()

    renderPerformanceResults(createValidSession())

    await user.click(
      screen.getByRole('button', {
        name: /Back to Dashboard/i,
      })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

  // TEST 8: Verify Dashboard navigation when data is missing.
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

  // TEST 9: Verify selected measure range.
  test('displays selected starting and ending measures', () => {
    renderPerformanceResults(createValidSession())

    const overview = document.querySelector(
      '.performance-session-overview'
    )

    expect(
      within(overview).getByText('Selected Measures')
    ).toBeInTheDocument()

    expect(
      within(overview).getByText('3–6')
    ).toBeInTheDocument()
  })

  // TEST 10: Verify score-to-performance alignment.
  test('displays expected and played notes with measure and beat', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(rows).toHaveLength(7)

    expect(
      within(rows[1])
        .getAllByRole('cell')
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

  // TEST 11: Verify incorrect pitch feedback.
  test('displays incorrect pitch feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[2])
        .getAllByRole('cell')
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

  // TEST 12: Verify missing-note feedback.
  test('displays missing note feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[3])
        .getAllByRole('cell')
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

  // TEST 13: Verify additional-note feedback.
  test('displays additional note feedback', () => {
    renderPerformanceResults(createFeedbackSession())

    const rows = within(getFeedbackTable()).getAllByRole('row')

    expect(
      within(rows[4])
        .getAllByRole('cell')
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

  // TEST 14: Verify early and late timing feedback.
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

  // TEST 15: Verify note-duration classifications.
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

  // TEST 16 - US-14: Pitch accuracy.
  test('displays pitch accuracy percentage and note counts', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getMetricCard('Pitch Accuracy')

    expect(
      within(card).getByText('93.75%')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('15 of 16 notes correct')
    ).toBeInTheDocument()

    expect(
      card.querySelector('.pitch-progress')
    ).toHaveStyle({ width: '93.75%' })
  })

  // TEST 17 - US-15: Rhythmic accuracy.
  test('displays rhythm, onset, and duration accuracy', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getMetricCard('Rhythmic Accuracy')

    expect(
      within(card).getByText('92.19%')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('Onset Accuracy: 94.50%')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('Duration Accuracy: 89.88%')
    ).toBeInTheDocument()

    expect(
      card.querySelector('.rhythm-progress')
    ).toHaveStyle({ width: '92.19%' })
  })

  // TEST 18 - US-16: Tempo consistency.
  test('displays tempo consistency and variation', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getMetricCard('Tempo Consistency')

    expect(
      within(card).getByText('90.17%')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('Tempo Variation: 9.83%')
    ).toBeInTheDocument()

    expect(
      card.querySelector('.tempo-progress')
    ).toHaveStyle({ width: '90.17%' })
  })

  // TEST 19 - US-18: Note sequence accuracy.
  test('displays note sequence accuracy', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getMetricCard('Note Sequence Accuracy')

    expect(
      within(card).getByText('87.50%')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('14 of 16 notes correct')
    ).toBeInTheDocument()

    expect(
      card.querySelector('.sequence-progress')
    ).toHaveStyle({ width: '87.5%' })
  })

  // TEST 20 - US-18: Detected error counts.
  test('displays incorrect, missing, and additional note counts', () => {
    renderPerformanceResults(createSprint3Session())

    const errorGrid = document.querySelector(
      '.performance-error-count-grid'
    )

    const cards = errorGrid.children

    expect(cards).toHaveLength(3)

    expect(
      within(cards[0]).getByText('Incorrect Pitches')
    ).toBeInTheDocument()

    expect(
      within(cards[0]).getByText('1')
    ).toBeInTheDocument()

    expect(
      within(cards[1]).getByText('Missing Notes')
    ).toBeInTheDocument()

    expect(
      within(cards[1]).getByText('1')
    ).toBeInTheDocument()

    expect(
      within(cards[2]).getByText('Additional Notes')
    ).toBeInTheDocument()

    expect(
      within(cards[2]).getByText('1')
    ).toBeInTheDocument()
  })

  // TEST 21 - US-17: Problem-area measure statistics.
  test('displays problem-area statistics and error rate', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getProblemCard(4)

    expect(card).toBeDefined()

    expect(
      within(card).getByText('4', {
        selector: 'strong',
      })
    ).toBeInTheDocument()

    expect(
      within(card).getByText('2')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('50.00%')
    ).toBeInTheDocument()
  })

  // TEST 22 - US-17: Practice recommendations.
  test('displays practice recommendations for problem areas', () => {
    renderPerformanceResults(createSprint3Session())

    const measure4 = getProblemCard(4)
    const measure5 = getProblemCard(5)

    expect(
      within(measure4).getByText('Requires Practice')
    ).toBeInTheDocument()

    expect(
      within(measure5).getByText('No Practice Required')
    ).toBeInTheDocument()

    expect(
      within(measure4).getByText('Requires Practice')
    ).toHaveClass('practice-required')

    expect(
      within(measure5).getByText('No Practice Required')
    ).toHaveClass('practice-not-required')
  })

  // TEST 23 - US-17: Error types.
  test('displays error types and counts for problem measures', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getProblemCard(4)

    expect(
      within(card).getByText('timing: 2')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('duration: 1')
    ).toBeInTheDocument()

    expect(
      within(card).getByText('missing: 1')
    ).toBeInTheDocument()
  })

  // TEST 24 - US-17: Error locations.
  test('displays beats and expected and played notes', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getErrorLocationCard(4)

    const rows = within(card)
      .getByRole('table')
      .querySelectorAll('tbody tr')

    expect(rows).toHaveLength(2)

    expect(
      within(rows[0])
        .getAllByRole('cell')
        .slice(0, 3)
        .map((cell) => cell.textContent)
    ).toEqual(['2', 'A4', 'N/A'])

    expect(
      within(rows[1])
        .getAllByRole('cell')
        .slice(0, 3)
        .map((cell) => cell.textContent)
    ).toEqual(['4', 'C#5', 'C5'])
  })

  // TEST 25 - US-17: Missing-note highlighting.
  test('highlights missing played notes', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getErrorLocationCard(4)

    const missingNote = card.querySelector(
      '.error-location-missing-note'
    )

    expect(missingNote).toBeInTheDocument()

    expect(missingNote).toHaveTextContent('N/A')
  })

  // TEST 26 - US-17: Color-coded error labels.
  test('assigns correct CSS classes to detected errors', () => {
    renderPerformanceResults(createSprint3Session())

    const measure4 = getErrorLocationCard(4)
    const measure5 = getErrorLocationCard(5)

    expect(
      measure4.querySelector('.error-type-missing')
    ).toBeInTheDocument()

    expect(
      measure4.querySelector('.error-type-timing')
    ).toBeInTheDocument()

    expect(
      measure4.querySelector('.error-type-duration')
    ).toBeInTheDocument()

    expect(
      measure5.querySelector('.error-type-incorrect-pitch')
    ).toBeInTheDocument()
  })

  // TEST 27: Missing performance summary.
  // Updated for UAT-06 insufficient audio data handling.
  test('handles audio results without a performance summary', () => {
    renderPerformanceResults(createValidSession())

    expect(
      screen.getByText(
        'Performance metrics could not be calculated from this recording.'
      )
    ).toBeInTheDocument()

    const errorGrid = document.querySelector(
      '.performance-error-count-grid'
    )

    expect(
      within(errorGrid).getAllByText('N/A')
    ).toHaveLength(3)

    expect(
      screen.getByText('Insufficient Data')
    ).toBeInTheDocument()
  })

  // TEST 28: No problem areas.
  // Updated for Keya's second UAT suggestion.
  test('handles an empty problem-area list', () => {
    renderPerformanceResults(createNoProblemAreasSession())

    expect(
      screen.getByText(
        '✓ No problem areas were identified for this performance.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        '✓ No problem-area error locations were identified.'
      )
    ).toBeInTheDocument()
  })

  // TEST 29: Missing note-level feedback.
  // Updated for UAT-06 insufficient audio data handling.
  test('handles a performance without note-level feedback', () => {
    renderPerformanceResults(createValidSession())

    expect(
      screen.getByText(
        'Note-level feedback is unavailable because there was not enough audio data for analysis.'
      )
    ).toBeInTheDocument()
  })

  // TEST 30: Progress bar boundaries.
  test('clamps progress bar widths between zero and 100 percent', () => {
    const audioResult = {
      ...mockAudioResult,
      performance_summary: {
        ...mockPerformanceSummary,
        metrics: {
          ...mockPerformanceSummary.metrics,
          pitch_accuracy: {
            accuracy_percent: 120,
            correct_notes: 16,
            total_expected_notes: 16,
          },
          tempo_consistency: {
            consistency_percent: -5,
            variation_percent: 0,
          },
        },
      },
    }

    renderPerformanceResults(createValidSession(audioResult))

    expect(
      document.querySelector('.pitch-progress')
    ).toHaveStyle({ width: '100%' })

    expect(
      document.querySelector('.tempo-progress')
    ).toHaveStyle({ width: '0%' })
  })

  // TEST 31: Playback controls are disabled.
  test('keeps future playback controls disabled', () => {
    renderPerformanceResults(createSprint3Session())

    expect(
      screen.getByRole('button', {
        name: /Play Performance/i,
      })
    ).toBeDisabled()

    expect(
      screen.getByRole('button', {
        name: /Expected Audio/i,
      })
    ).toBeDisabled()
  })

  // TEST 32 - UAT-06: Insufficient audio warning.
  test('displays an insufficient audio data warning', () => {
    renderPerformanceResults(createInsufficientAudioSession())

    expect(
      screen.getAllByText('Insufficient Audio Data').length
    ).toBeGreaterThan(0)

    expect(
      screen.getByText(
        /Please upload a longer recording and try again/i
      )
    ).toBeInTheDocument()
  })

  // TEST 33 - UAT-06: Session status badge.
  test('displays Insufficient Data instead of Analysis Complete', () => {
    renderPerformanceResults(createInsufficientAudioSession())

    const overview = document.querySelector(
      '.performance-session-overview'
    )

    expect(
      within(overview).getByText('Insufficient Data')
    ).toBeInTheDocument()

    expect(
      within(overview).queryByText('Analysis Complete')
    ).not.toBeInTheDocument()
  })

  // TEST 34 - UAT-06: Hide misleading success messages.
  test('does not display success messages for insufficient audio', () => {
    renderPerformanceResults(createInsufficientAudioSession())

    expect(
      screen.queryByText(/Audio successfully processed/i)
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Analysis Complete')
    ).not.toBeInTheDocument()
  })

  // TEST 35 - UAT-06: Valid audio still shows successful analysis.
  test('displays Analysis Complete for valid performance metrics', () => {
    renderPerformanceResults(createSprint3Session())

    expect(
      screen.getByText('Analysis Complete')
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Audio successfully processed/i)
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Insufficient Audio Data')
    ).not.toBeInTheDocument()
  })

  // TEST 36 - UAT-06: Zero accuracy is a valid metric.
  test('does not classify zero percent accuracy as insufficient data', () => {
    const audioResult = {
      ...mockAudioResult,
      performance_summary: {
        ...mockPerformanceSummary,
        metrics: {
          ...mockPerformanceSummary.metrics,
          pitch_accuracy: {
            accuracy_percent: 0,
            correct_notes: 0,
            total_expected_notes: 16,
          },
        },
      },
    }

    renderPerformanceResults(createValidSession(audioResult))

    expect(
      screen.getByText('Analysis Complete')
    ).toBeInTheDocument()

    const card = getMetricCard('Pitch Accuracy')

    expect(
      within(card).getByText('0.00%')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Insufficient Audio Data')
    ).not.toBeInTheDocument()
  })

  // TEST 37 - UAT: Successful analysis shows green empty states.
  test('displays green success styling when no problem areas are found', () => {
    renderPerformanceResults(createNoProblemAreasSession())

    const problemMessage = screen.getByText(
      '✓ No problem areas were identified for this performance.'
    )

    const errorMessage = screen.getByText(
      '✓ No problem-area error locations were identified.'
    )

    expect(problemMessage).toHaveClass(
      'performance-empty-success'
    )

    expect(errorMessage).toHaveClass(
      'performance-empty-success'
    )

    expect(problemMessage).not.toHaveClass(
      'performance-empty-neutral'
    )

    expect(errorMessage).not.toHaveClass(
      'performance-empty-neutral'
    )

    expect(
      screen.getByText('Analysis Complete')
    ).toBeInTheDocument()
  })

  // TEST 38 - UAT: Insufficient audio shows neutral empty states.
  test('displays neutral messages when problem areas cannot be evaluated', () => {
    renderPerformanceResults(createInsufficientAudioSession())

    const problemMessage = screen.getByText(
      'Problem areas could not be determined because there was not enough audio data for analysis.'
    )

    const errorMessage = screen.getByText(
      'Error locations could not be determined because there was not enough audio data for analysis.'
    )

    expect(problemMessage).toHaveClass(
      'performance-empty-neutral'
    )

    expect(errorMessage).toHaveClass(
      'performance-empty-neutral'
    )

    expect(problemMessage).not.toHaveClass(
      'performance-empty-success'
    )

    expect(errorMessage).not.toHaveClass(
      'performance-empty-success'
    )

    expect(
      screen.getByText('Insufficient Data')
    ).toBeInTheDocument()
  })

  // TEST 39 - UAT: Existing problem-area cards remain unchanged.
  test('preserves problem-area cards when errors are detected', () => {
    renderPerformanceResults(createSprint3Session())

    const measure4 = getProblemCard(4)
    const measure5 = getProblemCard(5)

    expect(measure4).toBeDefined()
    expect(measure5).toBeDefined()

    expect(getErrorLocationCard(4)).toBeDefined()
    expect(getErrorLocationCard(5)).toBeDefined()

    expect(
      document.querySelectorAll('.performance-problem-card')
    ).toHaveLength(2)

    expect(
      document.querySelectorAll('.error-location-measure-card')
    ).toHaveLength(2)

    expect(
      document.querySelector('.performance-empty-success')
    ).not.toBeInTheDocument()

    expect(
      document.querySelector('.performance-empty-neutral')
    ).not.toBeInTheDocument()
  })

  // TEST 40: A note judged the correct length shows its expected
  // length, even when the measured length rounds to another value.
  test('shows expected length as played length for correct durations', () => {
    renderPerformanceResults(
      createValidSession({
        ...mockAudioResult,
        status: 'audio_analyzed',
        note_feedback: [
          {
            measure: 2,
            beat: 2,
            expected_note: 'F4',
            played_note: 'F4',
            pitch_status: 'correct',
            expected_note_length: 'quarter note',
            played_note_length: 'half note',
            duration_status: 'correct',
            timing_status: 'on_time',
          },
          {
            measure: 4,
            beat: 2,
            expected_note: 'A4',
            played_note: 'A4',
            pitch_status: 'correct',
            expected_note_length: 'quarter note',
            played_note_length: 'eighth note',
            duration_status: 'too_short',
            timing_status: 'on_time',
          },
        ],
      })
    )

    const rows = within(getFeedbackTable()).getAllByRole('row')
    const playedLengthColumn = 6

    expect(
      within(rows[1]).getAllByRole('cell')[playedLengthColumn]
    ).toHaveTextContent('quarter note')

    expect(
      within(rows[2]).getAllByRole('cell')[playedLengthColumn]
    ).toHaveTextContent('eighth note')
  })

})
