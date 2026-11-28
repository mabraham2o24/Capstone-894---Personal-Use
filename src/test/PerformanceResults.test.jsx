
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import PerformanceResults from '../pages/PerformanceResults.jsx'

// Sprint 4 - Mock the temporary MusicXML file request during tests.
// This prevents ERR_INVALID_URL in Node.js without changing the app.
const SAMPLE_MUSICXML = `
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1"/>
  </part>
</score-partwise>
`

const REFERENCE_AUDIO_BLOB = new Blob(
  ['mock reference audio'],
  { type: 'audio/wav' }
)

function createReferenceResponse(
  tempoBpm = '80',
  tempoSource = 'performance'
) {
  return {
    ok: true,
    status: 200,
    blob: async () => REFERENCE_AUDIO_BLOB,
    headers: new Headers({
      'Content-Type': 'audio/wav',
      'X-Tempo-BPM': tempoBpm,
      'X-Tempo-Source': tempoSource,
      'X-Audio-Duration': '12.0',
    }),
  }
}

let originalCreateObjectURL
let originalRevokeObjectURL

beforeEach(() => {
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    'createObjectURL'
  )

  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    'revokeObjectURL'
  )

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((blob) => {
      if (blob instanceof File) {
        return 'blob:performance-audio'
      }

      return 'blob:reference-audio'
    }),
  })

  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })

  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('/reference-audio')) {
        return createReferenceResponse()
      }

      return {
        ok: true,
        text: async () => SAMPLE_MUSICXML,
      }
    })
  )

  localStorage.setItem(
    'vmi_access_token',
    'test-access-token'
  )
})

afterEach(() => {
  cleanup()

  localStorage.removeItem('vmi_access_token')

  vi.restoreAllMocks()
  vi.unstubAllGlobals()

  if (originalCreateObjectURL) {
    Object.defineProperty(
      URL,
      'createObjectURL',
      originalCreateObjectURL
    )
  } else {
    delete URL.createObjectURL
  }

  if (originalRevokeObjectURL) {
    Object.defineProperty(
      URL,
      'revokeObjectURL',
      originalRevokeObjectURL
    )
  } else {
    delete URL.revokeObjectURL
  }
})

//* Sample MusicXML information from the previous pages.
const mockScoreResult = {
  filename: 'sample.musicxml',
  status: 'processed',
}

//* Sample audio-analysis results returned by FastAPI.
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

//* Sample Sprint 2 note-level feedback.
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

//* Sample Sprint 3 performance summary.
//* Percentages are already on the 0-100 scale.
//* Problem-area error rates are on the 0-1 scale.
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

//* Mock page for testing navigation back to Performance Upload.
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

//* Render Performance Results with optional session data.
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

//* Standard valid session information.
function createValidSession(audioResult = mockAudioResult) {
  return {
    sessionId: 123,
    scoreResult: mockScoreResult,
    audioResult,
    startMeasure: 3,
    endMeasure: 6,
  }
}

//* Session with Sprint 2 note-level feedback.
function createFeedbackSession() {
  return createValidSession({
    ...mockAudioResult,
    status: 'audio_analyzed',
    note_feedback: mockNoteFeedback,
  })
}

//* Session with all Sprint 3 results.
function createSprint3Session() {
  return createValidSession({
    ...mockAudioResult,
    status: 'audio_analyzed',
    note_feedback: mockNoteFeedback,
    performance_summary: mockPerformanceSummary,
  })
}

function createPlaybackSession(
  filename = 'performance.wav'
) {
  return {
    ...createSprint3Session(),
    performanceAudioFile: new File(
      ['mock performance audio'],
      filename,
      { type: 'audio/wav' }
    ),
  }
}

//* Session with insufficient audio data for UAT-06.
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

//* Session with successful analysis and no problem areas.
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

//* Get the Performance Feedback table.
function getFeedbackTable() {
  const heading = screen.getByRole('heading', {
    name: 'Performance Feedback',
  })

  const column = heading.closest('.performance-results-column')
  return within(column).getByRole('table')
}

//* Get the Performance Summary metric cards.
function getMetricCard(label) {
  const summary = document.querySelector(
    '.performance-results-layout .summary-grid'
  )

  const labelElement = within(summary).getByText(label)
  return labelElement.parentElement
}

//* Get a problem-area overview card for a specific measure.
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

//* Get the error-location card for a specific measure.
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
  //* TEST 1: Verify the redesigned audio-processing summary.
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

  //* TEST 2: Verify individual detected pitch badges.
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

  //* TEST 3: Verify note-event counts.
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

  //* TEST 4: Verify empty detected pitches and note events.
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

  //* TEST 5: Verify missing performance data.
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

  //* TEST 6: Verify navigation to Performance Upload.
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

  //* TEST 7: Verify navigation to Dashboard.
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

  //* TEST 8: Verify Dashboard navigation when data is missing.
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

  //* TEST 9: Verify selected measure range.
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

  //* TEST 10: Verify score-to-performance alignment.
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

  //* TEST 11: Verify incorrect pitch feedback.
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

  //* TEST 12: Verify missing-note feedback.
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

  //* TEST 13: Verify additional-note feedback.
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

  //* TEST 14: Verify early and late timing feedback.
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

  //* TEST 15: Verify note-duration classifications.
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

  //* TEST 16 - US-14: Pitch accuracy.
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

  //* TEST 17 - US-15: Rhythmic accuracy.
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

  //* TEST 18 - US-16: Tempo consistency.
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

  //* TEST 19 - US-18: Note sequence accuracy.
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

  //* TEST 20 - US-18: Detected error counts.
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

  //* TEST 21 - US-17: Problem-area measure statistics.
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

  //* TEST 22 - US-17: Practice recommendations.
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

  //* TEST 23 - US-17: Error types.
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

  //* TEST 24 - US-17: Error locations.
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

  //* TEST 25 - US-17: Missing-note highlighting.
  test('highlights missing played notes', () => {
    renderPerformanceResults(createSprint3Session())

    const card = getErrorLocationCard(4)

    const missingNote = card.querySelector(
      '.error-location-missing-note'
    )

    expect(missingNote).toBeInTheDocument()

    expect(missingNote).toHaveTextContent('N/A')
  })

  //* TEST 26 - US-17: Color-coded error labels.
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

  //* TEST 27: Missing performance summary.
  //* Updated for UAT-06 insufficient audio data handling.
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

  //* TEST 28: No problem areas.
  //* Updated for Keya's second UAT suggestion.
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

  //* TEST 29: Missing note-level feedback.
  //* Updated for UAT-06 insufficient audio data handling.
  test('handles a performance without note-level feedback', () => {
    renderPerformanceResults(createValidSession())

    expect(
      screen.getByText(
        'Note-level feedback is unavailable because there was not enough audio data for analysis.'
      )
    ).toBeInTheDocument()
  })

  //* TEST 30: Progress bar boundaries.
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

  //* TEST 31: Performance and reference audio playback.
  test('displays both audio playback controls', async () => {
    renderPerformanceResults(createPlaybackSession())

    const performanceAudio = await screen.findByLabelText(
      'Your performance audio'
    )

    const referenceAudio = await screen.findByLabelText(
      'Expected reference audio'
    )

    expect(performanceAudio).toHaveAttribute('controls')
    expect(referenceAudio).toHaveAttribute('controls')

    expect(performanceAudio).toHaveAttribute(
      'src',
      'blob:performance-audio'
    )

    expect(referenceAudio).toHaveAttribute(
      'src',
      'blob:reference-audio'
    )
  })

  //* TEST 32 - UAT-06: Insufficient audio warning.
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

  //* TEST 33 - UAT-06: Session status badge.
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

  //* TEST 34 - UAT-06: Hide misleading success messages.
  test('does not display success messages for insufficient audio', () => {
    renderPerformanceResults(createInsufficientAudioSession())

    expect(
      screen.queryByText(/Audio successfully processed/i)
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Analysis Complete')
    ).not.toBeInTheDocument()
  })

  //* TEST 35 - UAT-06: Valid audio still shows successful analysis.
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

  //* TEST 36 - UAT-06: Zero accuracy is a valid metric.
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

  //* TEST 37 - UAT: Successful analysis shows green empty states.
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

  //* TEST 38 - UAT: Insufficient audio shows neutral empty states.
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

  //* TEST 39 - UAT: Existing problem-area cards remain unchanged.
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

  //* TEST 41: Authenticated reference audio request.
  test('requests reference audio for the selected measures', async () => {
    renderPerformanceResults(createPlaybackSession())

    await screen.findByLabelText('Expected reference audio')

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions/123/reference-audio?start_measure=3&end_measure=6',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      })
    )
  })

  //* TEST 42: Uploaded performance audio.
  test('uses the original uploaded WAV for playback', async () => {
    const session = createPlaybackSession(
      'uploaded_performance.wav'
    )

    renderPerformanceResults(session)

    await screen.findByLabelText('Expected reference audio')

    expect(URL.createObjectURL).toHaveBeenCalledWith(
      session.performanceAudioFile
    )

    expect(
      screen.getByLabelText('Your performance audio')
    ).toHaveAttribute('src', 'blob:performance-audio')
  })

  //* TEST 43: Simulated live-recorded WAV playback.
  test('supports playback of a live-recorded WAV file', async () => {
    const session = createPlaybackSession(
      'recorded_performance.wav'
    )

    renderPerformanceResults(session)

    await screen.findByLabelText('Expected reference audio')

    expect(URL.createObjectURL).toHaveBeenCalledWith(
      session.performanceAudioFile
    )

    expect(
      screen.getByLabelText('Your performance audio')
    ).toHaveAttribute('controls')
  })

  //* TEST 44: Selected measure labels.
  test('displays the selected measures for both audio players', async () => {
    renderPerformanceResults(createPlaybackSession())

    await screen.findByLabelText('Expected reference audio')

    expect(
      screen.getByText(/Measures 3–6 · Recorded audio/)
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Measures 3–6 · Computer-generated audio/)
    ).toBeInTheDocument()
  })

  //* TEST 45: Tempo metadata.
  test.each([
    ['100', 'score', 'Specified in the score'],
    ['80', 'performance', 'Estimated from your performance'],
    ['120', 'default', 'Default tempo'],
  ])(
    'displays %s BPM from the %s tempo source',
    async (bpm, source, label) => {
      fetch.mockImplementation(async (url) => {
        if (String(url).includes('/reference-audio')) {
          return createReferenceResponse(bpm, source)
        }

        return {
          ok: true,
          text: async () => SAMPLE_MUSICXML,
        }
      })

      renderPerformanceResults(createPlaybackSession())

      await screen.findByLabelText('Expected reference audio')

      expect(
        screen.getByText(`Tempo: ${bpm} BPM · ${label}`)
      ).toBeInTheDocument()
    }
  )

  //* TEST 46: Reference audio loading state.
  test('displays a loading message while generating reference audio', async () => {
    let resolveReference

    const pendingReference = new Promise((resolve) => {
      resolveReference = resolve
    })

    fetch.mockImplementation(async (url) => {
      if (String(url).includes('/reference-audio')) {
        return pendingReference
      }

      return {
        ok: true,
        text: async () => SAMPLE_MUSICXML,
      }
    })

    renderPerformanceResults(createPlaybackSession())

    expect(
      screen.getByText('Generating expected audio...')
    ).toBeInTheDocument()

    resolveReference(createReferenceResponse())

    await screen.findByLabelText('Expected reference audio')

    expect(
      screen.queryByText('Generating expected audio...')
    ).not.toBeInTheDocument()
  })

  //* TEST 47: Backend reference audio error.
  test('displays a reference audio API error without hiding performance playback', async () => {
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('/reference-audio')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            detail: 'No score notes found in the selected measure range.',
          }),
        }
      }

      return {
        ok: true,
        text: async () => SAMPLE_MUSICXML,
      }
    })

    renderPerformanceResults(createPlaybackSession())

    expect(
      await screen.findByText(
        'No score notes found in the selected measure range.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Your performance audio')
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText('Expected reference audio')
    ).not.toBeInTheDocument()
  })

  //* TEST 48: Network failure.
  test('handles a reference audio network failure', async () => {
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('/reference-audio')) {
        throw new Error('Network unavailable')
      }

      return {
        ok: true,
        text: async () => SAMPLE_MUSICXML,
      }
    })

    renderPerformanceResults(createPlaybackSession())

    expect(
      await screen.findByText('Network unavailable')
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Your performance audio')
    ).toBeInTheDocument()
  })

  //* TEST 49: Performance playback pauses reference audio.
  test('pauses reference audio when performance playback starts', async () => {
    renderPerformanceResults(createPlaybackSession())

    const performanceAudio = screen.getByLabelText(
      'Your performance audio'
    )

    const referenceAudio = await screen.findByLabelText(
      'Expected reference audio'
    )

    const pauseReference = vi
      .spyOn(referenceAudio, 'pause')
      .mockImplementation(() => {})

    fireEvent.play(performanceAudio)

    expect(pauseReference).toHaveBeenCalledOnce()
  })

  //* TEST 50: Reference playback pauses performance audio.
  test('pauses performance audio when reference playback starts', async () => {
    renderPerformanceResults(createPlaybackSession())

    const performanceAudio = screen.getByLabelText(
      'Your performance audio'
    )

    const referenceAudio = await screen.findByLabelText(
      'Expected reference audio'
    )

    const pausePerformance = vi
      .spyOn(performanceAudio, 'pause')
      .mockImplementation(() => {})

    fireEvent.play(referenceAudio)

    expect(pausePerformance).toHaveBeenCalledOnce()
  })

  //* TEST 51: Audio URL cleanup.
  test('releases both audio object URLs when leaving the page', async () => {
    const { unmount } = renderPerformanceResults(
      createPlaybackSession()
    )

    await screen.findByLabelText('Expected reference audio')

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:performance-audio'
    )

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:reference-audio'
    )
  })

  //* TEST 52: Original audio unavailable.
  test('handles missing original audio while retaining reference playback', async () => {
    renderPerformanceResults(createSprint3Session())

    expect(
      screen.getByText(
        'Original performance audio is unavailable.'
      )
    ).toBeInTheDocument()

    expect(
      await screen.findByLabelText('Expected reference audio')
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText('Your performance audio')
    ).not.toBeInTheDocument()
  })

  //* TEST 53: Missing session does not request reference audio.
  test('does not request reference audio without a session', () => {
    renderPerformanceResults()

    const referenceRequests = fetch.mock.calls.filter(
      ([url]) => String(url).includes('/reference-audio')
    )

    expect(referenceRequests).toHaveLength(0)
  })

  //* TEST 54: Cancel pending request when leaving the page.
  test('aborts the reference audio request when unmounted', async () => {
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('/reference-audio')) {
        return new Promise(() => {})
      }

      return {
        ok: true,
        text: async () => SAMPLE_MUSICXML,
      }
    })

    const { unmount } = renderPerformanceResults(
      createPlaybackSession()
    )

    await waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url]) => String(url).includes('/reference-audio')
        )
      ).toBe(true)
    })

    const referenceRequest = fetch.mock.calls.find(
      ([url]) => String(url).includes('/reference-audio')
    )

    const signal = referenceRequest[1].signal

    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })
})

//* ============================================================
//* SPRINT 4 - US-19: AI PRACTICE RECOMMENDATIONS
//* ============================================================

const mockAIFeedback = {
  overall_assessment:
    'Your pitch accuracy is strong, but timing and note duration require improvement.',
  recommendations: [
    {
      measure: 4,
      error_type: 'late',
      exercise:
        'Practice measure 4 slowly using a metronome.',
    },
    {
      measure: 5,
      error_type: 'incorrect_pitch',
      exercise:
        'Practice the incorrect notes in measure 5 individually.',
    },
    {
      measure: 6,
      error_type: 'too_long',
      exercise:
        'Practice maintaining the correct note duration.',
    },
  ],
  next_session_goal:
    'Improve rhythmic accuracy to at least 95%.',
}

//* Create a session containing previously generated AI feedback.
function createAIFeedbackSession(feedback = mockAIFeedback) {
  const session = createSprint3Session()

  return {
    ...session,
    audioResult: {
      ...session.audioResult,
      ai_feedback: feedback,
    },
  }
}

//* Get the AI Practice Feedback section.
function getAIFeedbackSection() {
  return screen.getByRole('region', {
    name: 'AI Practice Feedback',
  })
}

//* Get the Generate AI Practice Feedback button.
function getGenerateAIButton() {
  return within(getAIFeedbackSection()).getByRole(
    'button',
    {
      name: 'Generate AI Practice Feedback',
    }
  )
}

//* Mock the AI feedback API while preserving other API requests.
function mockAIFeedbackRequest(handler) {
  fetch.mockImplementation(async (url, options) => {
    if (String(url).includes('/ai-feedback')) {
      return handler(url, options)
    }

    if (String(url).includes('/reference-audio')) {
      return createReferenceResponse()
    }

    return {
      ok: true,
      status: 200,
      text: async () => SAMPLE_MUSICXML,
    }
  })
}

//* Create a successful AI feedback API response.
function createAIFeedbackResponse(
  feedback = mockAIFeedback
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ai_feedback: feedback,
    }),
  }
}

//* Get all AI feedback API requests.
function getAIFeedbackRequests() {
  return fetch.mock.calls.filter(([url]) =>
    String(url).includes('/ai-feedback')
  )
}

describe('US-19 - AI Practice Recommendations', () => {

  //* TEST 55: Verify the AI practice feedback interface.
  test('displays the AI practice feedback section', () => {
    renderPerformanceResults(createSprint3Session())

    const section = getAIFeedbackSection()

    expect(section).toBeInTheDocument()

    expect(
      within(section).getByRole('heading', {
        name: 'AI Practice Feedback',
      })
    ).toBeInTheDocument()

    expect(
      within(section).getByText(
        'Receive personalized practice recommendations based on your performance analysis.'
      )
    ).toBeInTheDocument()

    expect(getGenerateAIButton()).toBeEnabled()

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(0)
  })

  //* TEST 56: Verify the authenticated AI feedback API request.
  test('sends an authenticated POST request to generate AI feedback', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() =>
      createAIFeedbackResponse()
    )

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    expect(
      await screen.findByText(
        mockAIFeedback.overall_assessment
      )
    ).toBeInTheDocument()

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions/123/ai-feedback',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      })
    )

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(1)
  })

  //* TEST 57: Verify the overall performance assessment.
  test('displays the generated overall assessment', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() =>
      createAIFeedbackResponse()
    )

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('heading', {
        name: 'Overall Assessment',
      })
    ).toBeInTheDocument()

    expect(
      within(section).getByText(
        mockAIFeedback.overall_assessment
      )
    ).toBeInTheDocument()
  })

  //* TEST 58: Verify personalized practice exercises.
  test('displays recommended exercises with measures and error types', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() =>
      createAIFeedbackResponse()
    )

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('heading', {
        name: 'Recommended Practice Exercises',
      })
    ).toBeInTheDocument()

    const exercises =
      within(section).getAllByRole('article')

    expect(exercises).toHaveLength(3)

    expect(
      within(exercises[0]).getByRole('heading', {
        name: 'Exercise 1',
      })
    ).toBeInTheDocument()

    expect(
      within(exercises[0]).getByText('Measure 4')
    ).toBeInTheDocument()

    expect(
      within(exercises[0]).getByText('late')
    ).toBeInTheDocument()

    expect(
      within(exercises[0]).getByText(
        mockAIFeedback.recommendations[0].exercise
      )
    ).toBeInTheDocument()

    expect(
      within(exercises[1]).getByText('Measure 5')
    ).toBeInTheDocument()

    expect(
      within(exercises[1]).getByText(
        'incorrect pitch'
      )
    ).toBeInTheDocument()

    expect(
      within(exercises[1]).getByText(
        mockAIFeedback.recommendations[1].exercise
      )
    ).toBeInTheDocument()

    expect(
      within(exercises[2]).getByText('Measure 6')
    ).toBeInTheDocument()

    expect(
      within(exercises[2]).getByText('too long')
    ).toBeInTheDocument()

    expect(
      within(exercises[2]).getByText(
        mockAIFeedback.recommendations[2].exercise
      )
    ).toBeInTheDocument()
  })

  //* TEST 59: Verify the next-session practice goal.
  test('displays the generated next-session practice goal', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() =>
      createAIFeedbackResponse()
    )

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('heading', {
        name: 'Next-Session Practice Goal',
      })
    ).toBeInTheDocument()

    expect(
      within(section).getByText(
        mockAIFeedback.next_session_goal
      )
    ).toBeInTheDocument()
  })

  //* TEST 60: Verify the maximum of three recommendations.
  test('displays no more than three recommended exercises', async () => {
    const user = userEvent.setup()

    const feedback = {
      ...mockAIFeedback,
      recommendations: [
        ...mockAIFeedback.recommendations,
        {
          measure: 7,
          error_type: 'early',
          exercise:
            'This fourth exercise should not be displayed.',
        },
      ],
    }

    mockAIFeedbackRequest(() =>
      createAIFeedbackResponse(feedback)
    )

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    await within(section).findByRole('heading', {
      name: 'Recommended Practice Exercises',
    })

    expect(
      within(section).getAllByRole('article')
    ).toHaveLength(3)

    expect(
      within(section).queryByText(
        'This fourth exercise should not be displayed.'
      )
    ).not.toBeInTheDocument()
  })

  //* TEST 61: Verify feedback with no recommended exercises.
  test('displays assessment and goal when recommendations are empty', async () => {
    const user = userEvent.setup()

    const feedback = {
      overall_assessment:
        'No significant performance errors were detected.',
      recommendations: [],
      next_session_goal:
        'Maintain consistent performance accuracy.',
    }

    mockAIFeedbackRequest(() =>
      createAIFeedbackResponse(feedback)
    )

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByText(
        feedback.overall_assessment
      )
    ).toBeInTheDocument()

    expect(
      within(section).getByText(
        feedback.next_session_goal
      )
    ).toBeInTheDocument()

    expect(
      within(section).queryByRole('heading', {
        name: 'Recommended Practice Exercises',
      })
    ).not.toBeInTheDocument()

    expect(
      within(section).queryAllByRole('article')
    ).toHaveLength(0)
  })

  //* TEST 62: Verify loading state and duplicate request prevention.
  test('disables feedback generation while an AI request is pending', async () => {
    const user = userEvent.setup()

    let resolveFeedback

    const pendingFeedback = new Promise((resolve) => {
      resolveFeedback = resolve
    })

    mockAIFeedbackRequest(() => pendingFeedback)

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    const loadingButton = within(section).getByRole(
      'button',
      {
        name: 'Generating AI Practice Feedback...',
      }
    )

    expect(loadingButton).toBeDisabled()

    expect(
      within(section).getByRole('status')
    ).toHaveTextContent(
      'Generating personalized feedback. This may take a moment.'
    )

    await user.click(loadingButton)

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(1)

    resolveFeedback(createAIFeedbackResponse())

    expect(
      await within(section).findByText(
        mockAIFeedback.overall_assessment
      )
    ).toBeInTheDocument()

    expect(getGenerateAIButton()).toBeEnabled()

    expect(
      within(section).queryByRole('status')
    ).not.toBeInTheDocument()
  })

  //* TEST 63: Verify previously generated AI feedback.
  test('displays existing AI feedback without requesting it again', () => {
    renderPerformanceResults(
      createAIFeedbackSession()
    )

    const section = getAIFeedbackSection()

    expect(
      within(section).getByText(
        mockAIFeedback.overall_assessment
      )
    ).toBeInTheDocument()

    expect(
      within(section).getAllByRole('article')
    ).toHaveLength(3)

    expect(
      within(section).getByText(
        mockAIFeedback.next_session_goal
      )
    ).toBeInTheDocument()

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(0)
  })

  //* TEST 64: Verify insufficient performance data handling.
  test('prevents AI feedback generation without a performance summary', async () => {
    const user = userEvent.setup()

    renderPerformanceResults(
      createInsufficientAudioSession()
    )

    const section = getAIFeedbackSection()

    expect(getGenerateAIButton()).toBeDisabled()

    expect(
      within(section).getByText(
        'Complete a performance analysis before requesting AI feedback.'
      )
    ).toBeInTheDocument()

    await user.click(getGenerateAIButton())

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(0)

    expect(
      within(section).queryByRole('heading', {
        name: 'Overall Assessment',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 65: Verify backend error handling.
  test('displays the backend AI feedback error message', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() => ({
      ok: false,
      status: 500,
      json: async () => ({
        detail:
          'AI feedback service is temporarily unavailable.',
      }),
    }))

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('alert')
    ).toHaveTextContent(
      'AI feedback service is temporarily unavailable.'
    )

    expect(getGenerateAIButton()).toBeEnabled()

    expect(
      within(section).queryByRole('status')
    ).not.toBeInTheDocument()

    expect(
      within(section).queryByRole('heading', {
        name: 'Overall Assessment',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 66: Verify invalid backend response handling.
  test('rejects an invalid AI feedback response', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        ai_feedback: {
          overall_assessment:
            'Incomplete feedback response.',
          recommendations: null,
        },
      }),
    }))

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('alert')
    ).toHaveTextContent(
      'No valid AI practice feedback was returned. Please try again.'
    )

    expect(getGenerateAIButton()).toBeEnabled()

    expect(
      within(section).queryByRole('heading', {
        name: 'Overall Assessment',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 67: Verify AI feedback network failure handling.
  test('displays a connection error when the AI feedback request fails', async () => {
    const user = userEvent.setup()

    mockAIFeedbackRequest(() => {
      throw new TypeError('Failed to fetch')
    })

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('alert')
    ).toHaveTextContent(
      'Unable to connect to the backend. Please check your connection and try again.'
    )

    expect(getGenerateAIButton()).toBeEnabled()

    expect(
      within(section).queryByRole('status')
    ).not.toBeInTheDocument()

    //* Existing performance results remain available.
    expect(
      within(
        getMetricCard('Pitch Accuracy')
      ).getByText('93.75%')
    ).toBeInTheDocument()
  })

  //* TEST 68: Verify successful retry after an AI feedback error.
  test('allows AI feedback generation to be retried after a failure', async () => {
    const user = userEvent.setup()

    let requestCount = 0

    mockAIFeedbackRequest(() => {
      requestCount += 1

      if (requestCount === 1) {
        return {
          ok: false,
          status: 500,
          json: async () => ({
            detail:
              'Unable to generate feedback at this time.',
          }),
        }
      }

      return createAIFeedbackResponse()
    })

    renderPerformanceResults(createSprint3Session())

    await user.click(getGenerateAIButton())

    const section = getAIFeedbackSection()

    expect(
      await within(section).findByRole('alert')
    ).toHaveTextContent(
      'Unable to generate feedback at this time.'
    )

    expect(getGenerateAIButton()).toBeEnabled()

    await user.click(getGenerateAIButton())

    expect(
      await within(section).findByText(
        mockAIFeedback.overall_assessment
      )
    ).toBeInTheDocument()

    expect(
      within(section).queryByRole('alert')
    ).not.toBeInTheDocument()

    expect(
      within(section).getAllByRole('article')
    ).toHaveLength(3)

    expect(
      within(section).getByText(
        mockAIFeedback.next_session_goal
      )
    ).toBeInTheDocument()

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(2)

    expect(getGenerateAIButton()).toBeEnabled()
  })
})

//* ============================================================
//* SPRINT 4 - US-20: HISTORICAL PERFORMANCE RESULTS
//* ============================================================

//* Create a previously completed practice session.
function createHistoricalSession(overrides = {}) {
  const session = createSprint3Session()

  return {
    ...session,
    isHistoricalSession: true,
    practiceDate: '2026-11-27T21:30:00Z',
    startMeasure: null,
    endMeasure: null,
    performanceAudioFile: null,
    ...overrides,
  }
}

//* Create a historical session containing saved AI feedback.
function createHistoricalAIFeedbackSession() {
  const session = createHistoricalSession()

  return {
    ...session,
    audioResult: {
      ...session.audioResult,
      ai_feedback: mockAIFeedback,
    },
  }
}

//* Render historical results with Practice History navigation.
function renderHistoricalPerformanceResults(
  state = createHistoricalSession()
) {
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
          path="/practice-history"
          element={<h1>Practice History Test Page</h1>}
        />

        <Route
          path="/dashboard"
          element={<h1>Dashboard Test Page</h1>}
        />

        <Route
          path="/performance-upload"
          element={<MockPerformanceUpload />}
        />
      </Routes>
    </MemoryRouter>
  )
}

//* Get the saved practice date information card.
function getPracticeDateCard() {
  return screen
    .getByText('Practice Date', { exact: true })
    .closest('.performance-session-info-card')
}

//* Get the selected measures information card.
function getHistoricalMeasuresCard() {
  return screen
    .getByText('Selected Measures', { exact: true })
    .closest('.performance-session-stat-card')
}

//* Get reference audio API requests.
function getHistoricalReferenceAudioRequests() {
  return fetch.mock.calls.filter(([url]) =>
    String(url).includes('/reference-audio')
  )
}

describe('US-20 - Historical Performance Results', () => {

  //* TEST 69: Verify the historical results page heading.
  test('displays the historical performance results heading', () => {
    renderHistoricalPerformanceResults()

    expect(
      screen.getByRole('heading', {
        name: 'Historical Performance Results',
        level: 1,
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        '✓ Saved performance results retrieved successfully.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText(
        '✓ Audio successfully processed.'
      )
    ).not.toBeInTheDocument()
  })

  //* TEST 70: Verify saved performance metrics.
  test('displays the saved performance accuracy metrics', () => {
    const session = createHistoricalSession()

    renderHistoricalPerformanceResults(session)

    const metrics =
      session.audioResult.performance_summary.metrics

    const expectedMetrics = [
      {
        label: 'Pitch Accuracy',
        value: metrics.pitch_accuracy.accuracy_percent,
      },
      {
        label: 'Rhythmic Accuracy',
        value: metrics.rhythmic_accuracy.accuracy_percent,
      },
      {
        label: 'Tempo Consistency',
        value: metrics.tempo_consistency.consistency_percent,
      },
      {
        label: 'Note Sequence Accuracy',
        value: metrics.note_sequence_accuracy.accuracy_percent,
      },
    ]

    expectedMetrics.forEach(({ label, value }) => {
      expect(
        within(getMetricCard(label)).getByText(
          `${Number(value).toFixed(2)}%`,
          { exact: true }
        )
      ).toBeInTheDocument()
    })
  })

  //* TEST 71: Verify saved session information.
  test('displays the saved audio filename and session ID', () => {
    const session = createHistoricalSession()

    renderHistoricalPerformanceResults(session)

    const audioCard = screen
      .getByText('Audio File', { exact: true })
      .closest('.performance-session-info-card')

    const sessionCard = screen
      .getByText('Session ID', { exact: true })
      .closest('.performance-session-info-card')

    expect(
      within(audioCard).getByText(
        session.audioResult.filename
      )
    ).toBeInTheDocument()

    expect(
      within(sessionCard).getByText(
        String(session.sessionId)
      )
    ).toBeInTheDocument()
  })

  //* TEST 72: Verify saved practice date formatting.
  test('displays the formatted historical practice date', () => {
    const session = createHistoricalSession()

    renderHistoricalPerformanceResults(session)

    const expectedDate = new Date(
      session.practiceDate
    ).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    expect(
      within(getPracticeDateCard()).getByText(
        expectedDate
      )
    ).toBeInTheDocument()
  })

  //* TEST 73: Verify missing practice date handling.
  test('displays Not available when the practice date is missing', () => {
    renderHistoricalPerformanceResults(
      createHistoricalSession({
        practiceDate: null,
      })
    )

    expect(
      within(getPracticeDateCard()).getByText(
        'Not available'
      )
    ).toBeInTheDocument()
  })

  //* TEST 74: Verify invalid practice date handling.
  test('displays Not available when the practice date is invalid', () => {
    renderHistoricalPerformanceResults(
      createHistoricalSession({
        practiceDate: 'invalid-date',
      })
    )

    expect(
      within(getPracticeDateCard()).getByText(
        'Not available'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Invalid Date')
    ).not.toBeInTheDocument()
  })

  //* TEST 75: Verify unavailable selected measures.
  test('displays Not available when historical measure information is missing', () => {
    renderHistoricalPerformanceResults()

    expect(
      within(
        getHistoricalMeasuresCard()
      ).getByText('Not available')
    ).toBeInTheDocument()
  })

  //* TEST 76: Verify saved note-level feedback.
  test('displays the previously saved note-level feedback', () => {
    const session = createHistoricalSession()

    renderHistoricalPerformanceResults(session)

    expect(
      screen.getByText(
        'Review the saved pitch, timing, and note duration feedback for this practice session.'
      )
    ).toBeInTheDocument()

    const feedbackTable = getFeedbackTable()

    expect(feedbackTable).toBeInTheDocument()

    const rows = within(feedbackTable).getAllByRole(
      'row'
    )

    expect(rows).toHaveLength(
      session.audioResult.note_feedback.length + 1
    )

    const firstFeedback =
      session.audioResult.note_feedback[0]

    expect(
      within(rows[1]).getAllByRole('cell')[0]
    ).toHaveTextContent(
      String(firstFeedback.measure)
    )

    expect(
      within(rows[1]).getAllByRole('cell')[2]
    ).toHaveTextContent(
      firstFeedback.expected_note
    )
  })

  //* TEST 77: Verify previously generated AI feedback.
  test('displays the saved AI assessment and next-session goal', () => {
    renderHistoricalPerformanceResults(
      createHistoricalAIFeedbackSession()
    )

    const section = getAIFeedbackSection()

    expect(
      within(section).getByText(
        'Review previously generated personalized practice recommendations for this session.'
      )
    ).toBeInTheDocument()

    expect(
      within(section).getByRole('heading', {
        name: 'Overall Assessment',
      })
    ).toBeInTheDocument()

    expect(
      within(section).getByText(
        mockAIFeedback.overall_assessment
      )
    ).toBeInTheDocument()

    expect(
      within(section).getByRole('heading', {
        name: 'Next-Session Practice Goal',
      })
    ).toBeInTheDocument()

    expect(
      within(section).getByText(
        mockAIFeedback.next_session_goal
      )
    ).toBeInTheDocument()
  })

  //* TEST 78: Verify saved personalized exercises.
  test('displays the previously generated practice exercises', () => {
    renderHistoricalPerformanceResults(
      createHistoricalAIFeedbackSession()
    )

    const section = getAIFeedbackSection()

    expect(
      within(section).getByRole('heading', {
        name: 'Recommended Practice Exercises',
      })
    ).toBeInTheDocument()

    const exercises =
      within(section).getAllByRole('article')

    expect(exercises).toHaveLength(3)

    mockAIFeedback.recommendations.forEach(
      (recommendation, index) => {
        expect(
          within(exercises[index]).getByText(
            `Measure ${recommendation.measure}`
          )
        ).toBeInTheDocument()

        expect(
          within(exercises[index]).getByText(
            recommendation.error_type.replace(
              /_/g,
              ' '
            )
          )
        ).toBeInTheDocument()

        expect(
          within(exercises[index]).getByText(
            recommendation.exercise
          )
        ).toBeInTheDocument()
      }
    )
  })

  //* TEST 79: Verify historical sessions without AI feedback.
  test('displays an appropriate message when no saved AI feedback exists', () => {
    const session = createHistoricalSession()

    renderHistoricalPerformanceResults({
      ...session,
      audioResult: {
        ...session.audioResult,
        ai_feedback: null,
      },
    })

    const section = getAIFeedbackSection()

    expect(
      within(section).getByText(
        'No previously generated AI practice feedback is available for this practice session.'
      )
    ).toBeInTheDocument()

    expect(
      within(section).queryByRole('heading', {
        name: 'Overall Assessment',
      })
    ).not.toBeInTheDocument()

    expect(
      within(section).queryAllByRole('article')
    ).toHaveLength(0)
  })

  //* TEST 80: Prevent AI feedback generation for historical sessions.
  test('does not display the AI feedback generation button for historical sessions', () => {
    renderHistoricalPerformanceResults(
      createHistoricalAIFeedbackSession()
    )

    const section = getAIFeedbackSection()

    expect(
      within(section).queryByRole('button', {
        name: 'Generate AI Practice Feedback',
      })
    ).not.toBeInTheDocument()

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(0)
  })

  //* TEST 81: Prevent automatic AI requests for sessions without feedback.
  test('does not automatically generate AI feedback for a historical session without saved feedback', async () => {
    const session = createHistoricalSession()

    renderHistoricalPerformanceResults({
      ...session,
      audioResult: {
        ...session.audioResult,
        ai_feedback: null,
      },
    })

    expect(
      await within(
        getAIFeedbackSection()
      ).findByText(
        'No previously generated AI practice feedback is available for this practice session.'
      )
    ).toBeInTheDocument()

    expect(
      within(
        getAIFeedbackSection()
      ).queryByRole('button')
    ).not.toBeInTheDocument()

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(0)
  })

  //* TEST 82: Verify historical audio playback restrictions.
  test('displays unavailable audio playback messages for historical sessions', () => {
    renderHistoricalPerformanceResults()

    expect(
      screen.getByRole('heading', {
        name: 'Historical Audio Playback',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Original audio playback is not available for historical practice sessions.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Expected audio playback is not available for historical practice sessions.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText(
        'Your performance audio'
      )
    ).not.toBeInTheDocument()

    expect(
      screen.queryByLabelText(
        'Expected reference audio'
      )
    ).not.toBeInTheDocument()
  })

  //* TEST 83: Prevent audio requests even when playback information exists.
  test('does not create audio URLs or request reference audio for historical sessions', () => {
    renderHistoricalPerformanceResults(
      createHistoricalSession({
        startMeasure: 3,
        endMeasure: 6,
        performanceAudioFile: new File(
          ['mock historical recording'],
          'historical.wav',
          { type: 'audio/wav' }
        ),
      })
    )

    expect(
      URL.createObjectURL
    ).not.toHaveBeenCalled()

    expect(
      getHistoricalReferenceAudioRequests()
    ).toHaveLength(0)

    expect(
      screen.queryByLabelText(
        'Your performance audio'
      )
    ).not.toBeInTheDocument()

    expect(
      screen.queryByLabelText(
        'Expected reference audio'
      )
    ).not.toBeInTheDocument()
  })

  //* TEST 84: Verify top Back to Practice History navigation.
  test('returns to Practice History using the top navigation button', async () => {
    const user = userEvent.setup()

    renderHistoricalPerformanceResults()

    await user.click(
      screen.getByRole('button', {
        name: '← Back to Practice History',
        exact: true,
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Practice History Test Page',
      })
    ).toBeInTheDocument()
  })

  //* TEST 85: Verify bottom Back to Practice History navigation.
  test('returns to Practice History using the bottom navigation button', async () => {
    const user = userEvent.setup()

    renderHistoricalPerformanceResults()

    await user.click(
      screen.getByRole('button', {
        name: 'Back to Practice History',
        exact: true,
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Practice History Test Page',
      })
    ).toBeInTheDocument()
  })

  //* TEST 86: Verify missing historical session data handling.
  test('handles missing historical session data and allows navigation back', async () => {
    const user = userEvent.setup()

    renderHistoricalPerformanceResults({
      isHistoricalSession: true,
      sessionId: null,
      audioResult: null,
    })

    expect(
      screen.getByRole('heading', {
        name: 'Performance Results',
        level: 1,
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'No processed performance is available.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('region', {
        name: 'AI Practice Feedback',
      })
    ).not.toBeInTheDocument()

    expect(fetch).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', {
        name: '← Back to Practice History',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Practice History Test Page',
      })
    ).toBeInTheDocument()
  })
})

//* ============================================================
//* SPRINT 4 - ANNOTATED SHEET MUSIC INTEGRATION
//* ============================================================

//* Create a session containing backend score annotations.
function createAnnotatedScoreSession() {
  const session = createSprint3Session()

  return {
    ...session,
    audioResult: {
      ...session.audioResult,
      score_annotations: {
        notes: [],
        additional_notes: [],
      },
    },
  }
}

//* Create a successful MusicXML API response.
function createScoreResponse(xml = SAMPLE_MUSICXML) {
  return {
    ok: true,
    status: 200,
    text: async () => xml,
    headers: new Headers({
      'Content-Type':
        'application/vnd.recordare.musicxml+xml',
    }),
  }
}

//* Mock the score API without affecting reference audio.
function mockScoreRequest(handler) {
  fetch.mockImplementation(async (url, options) => {
    if (String(url).endsWith('/score')) {
      return handler(url, options)
    }

    if (String(url).includes('/reference-audio')) {
      return createReferenceResponse()
    }

    if (String(url).includes('/ai-feedback')) {
      return createAIFeedbackResponse()
    }

    return createScoreResponse()
  })
}

//* Get all uploaded score API requests.
function getScoreRequests() {
  return fetch.mock.calls.filter(([url]) =>
    String(url).endsWith('/score')
  )
}

//* Verify that the existing performance results remain available.
function expectPerformanceResultsAvailable() {
  expect(
    screen.getByRole('heading', {
      name: 'Performance Summary',
      exact: true,
    })
  ).toBeInTheDocument()

  expect(
    screen.getByRole('heading', {
      name: 'Performance Feedback',
      exact: true,
    })
  ).toBeInTheDocument()

  expect(
    within(getMetricCard('Pitch Accuracy')).getByText(
      '93.75%'
    )
  ).toBeInTheDocument()
}

describe('Sprint 4 - Annotated Sheet Music Integration', () => {

  //* TEST 87: Verify the annotated sheet music interface.
  test('displays the annotated sheet music section', () => {
    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      screen.getByRole('heading', {
        name: 'Annotated Sheet Music',
      })
    ).toBeInTheDocument()
  })

  //* TEST 88: Verify the authenticated uploaded score request.
  test('requests the uploaded score using the session ID and access token', async () => {
    mockScoreRequest(() => createScoreResponse())

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/sessions/123/score',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
          signal: expect.any(AbortSignal),
        })
      )
    })

    expect(getScoreRequests()).toHaveLength(1)
  })

  //* TEST 89: Verify that the correct session score is requested.
  test('requests the score associated with the selected session', async () => {
    const session = {
      ...createAnnotatedScoreSession(),
      sessionId: 'practice-session-456',
    }

    mockScoreRequest(() => createScoreResponse())

    renderPerformanceResults(session)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/sessions/practice-session-456/score',
        expect.any(Object)
      )
    })

    expect(
      getScoreRequests().some(([url]) =>
        String(url).includes('/sessions/123/score')
      )
    ).toBe(false)
  })

  //* TEST 90: Verify successful MusicXML retrieval.
  test('reads the uploaded MusicXML returned by the backend', async () => {
    const readMusicXML = vi.fn(
      async () => SAMPLE_MUSICXML
    )

    mockScoreRequest(() => ({
      ...createScoreResponse(),
      text: readMusicXML,
    }))

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    await waitFor(() => {
      expect(readMusicXML).toHaveBeenCalledTimes(1)
    })

    expect(
      screen.getByRole('heading', {
        name: 'Annotated Sheet Music',
      })
    ).toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 91: Verify the sheet music loading state.
  test('displays a loading message while retrieving the uploaded score', async () => {
    let resolveScore

    const pendingScore = new Promise((resolve) => {
      resolveScore = resolve
    })

    mockScoreRequest(() => pendingScore)

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      screen.getByText('Loading sheet music...')
    ).toBeInTheDocument()

    //* Other performance information remains available.
    expectPerformanceResultsAvailable()

    resolveScore(createScoreResponse())

    await waitFor(() => {
      expect(
        screen.queryByText('Loading sheet music...')
      ).not.toBeInTheDocument()
    })
  })

  //* TEST 92: Verify missing uploaded score handling.
  test('displays an appropriate message when the uploaded score is unavailable', async () => {
    mockScoreRequest(() => ({
      ok: false,
      status: 404,
    }))

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      await screen.findByText(
        'The uploaded sheet music is unavailable for this session. Older practice sessions may not have a stored score.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Loading sheet music...')
    ).not.toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 93: Verify unauthorized score access.
  test('displays an authorization error when the score request returns 401', async () => {
    mockScoreRequest(() => ({
      ok: false,
      status: 401,
    }))

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      await screen.findByText(
        'You are not authorized to retrieve this sheet music. Please sign in again.'
      )
    ).toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 94: Verify forbidden score access.
  test('displays an authorization error when the score request returns 403', async () => {
    mockScoreRequest(() => ({
      ok: false,
      status: 403,
    }))

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      await screen.findByText(
        'You are not authorized to retrieve this sheet music. Please sign in again.'
      )
    ).toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 95: Verify backend server error handling.
  test('displays an error when the score request returns a server failure', async () => {
    mockScoreRequest(() => ({
      ok: false,
      status: 500,
    }))

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      await screen.findByText(
        'Unable to retrieve the uploaded sheet music.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Loading sheet music...')
    ).not.toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 96: Verify empty MusicXML response handling.
  test('displays an error when the uploaded MusicXML is empty', async () => {
    mockScoreRequest(() => createScoreResponse('   '))

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      await screen.findByText(
        'The uploaded sheet music is empty.'
      )
    ).toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 97: Verify network connection failure handling.
  test('displays a connection error when the score request fails', async () => {
    mockScoreRequest(() => {
      throw new TypeError('Failed to fetch')
    })

    renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    expect(
      await screen.findByText(
        'Unable to connect to the backend to retrieve sheet music.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Loading sheet music...')
    ).not.toBeInTheDocument()

    expectPerformanceResultsAvailable()
  })

  //* TEST 98: Verify uploaded score retrieval for historical sessions.
  test('retrieves the uploaded score when viewing historical performance results', async () => {
    const session = createHistoricalSession({
      sessionId: 'historical-session-789',
    })

    const readMusicXML = vi.fn(
      async () => SAMPLE_MUSICXML
    )

    mockScoreRequest(() => ({
      ...createScoreResponse(),
      text: readMusicXML,
    }))

    renderHistoricalPerformanceResults(session)

    expect(
      screen.getByRole('heading', {
        name: 'Historical Performance Results',
      })
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/sessions/historical-session-789/score',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      )

      expect(readMusicXML).toHaveBeenCalledTimes(1)
    })

    expect(getScoreRequests()).toHaveLength(1)

    expect(
      getHistoricalReferenceAudioRequests()
    ).toHaveLength(0)

    expect(
      getAIFeedbackRequests()
    ).toHaveLength(0)

    expectPerformanceResultsAvailable()
  })

  //* TEST 99: Prevent score retrieval without valid session data.
  test('does not request uploaded sheet music without a valid session', () => {
    renderPerformanceResults({
      sessionId: null,
      audioResult: null,
    })

    expect(
      screen.getByText(
        'No processed performance is available.'
      )
    ).toBeInTheDocument()

    expect(getScoreRequests()).toHaveLength(0)

    expect(
      screen.queryByRole('heading', {
        name: 'Annotated Sheet Music',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 100: Verify cancellation of pending score requests.
  test('aborts the uploaded score request when the page unmounts', async () => {
    let scoreSignal
    let resolveScore

    const pendingScore = new Promise((resolve) => {
      resolveScore = resolve
    })

    mockScoreRequest((url, options) => {
      scoreSignal = options.signal

      return pendingScore
    })

    const { unmount } = renderPerformanceResults(
      createAnnotatedScoreSession()
    )

    await waitFor(() => {
      expect(scoreSignal).toBeDefined()
    })

    expect(scoreSignal.aborted).toBe(false)

    unmount()

    expect(scoreSignal.aborted).toBe(true)

    resolveScore(createScoreResponse())
  })
})