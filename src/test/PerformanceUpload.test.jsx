
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'

import PerformanceUpload from '../pages/PerformanceUpload.jsx'

// Sample score information from the previous page.
const mockScoreResult = {
  filename: 'sample.musicxml',
  status: 'processed',
}

// Sample audio analysis response from the backend.
const mockAudioResult = {
  filename: 'performance.wav',
  status: 'audio_analyzed',
  detected_pitches: ['C4', 'D4', 'E4'],
  note_feedback: [],
}

// Sprint 3 backend response containing US-14 through US-18.
const mockSprint3AudioResult = {
  ...mockAudioResult,
  note_events: [
    { pitch: 'C4', onset: 0, duration: 0.5 },
    { pitch: 'D4', onset: 0.5, duration: 0.5 },
  ],
  note_feedback: [
    {
      measure: 4,
      beat: 2,
      expected_note: 'A4',
      played_note: null,
      pitch_status: 'missing',
      timing_status: null,
      duration_status: null,
    },
  ],
  performance_summary: {
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
      additional_notes: 0,
    },
    problem_areas: [
      {
        measure: 4,
        total_notes: 4,
        error_notes: 1,
        error_rate: 0.25,
        requires_practice: true,
        error_types: {
          missing: 1,
        },
        error_locations: [
          {
            beat: 2,
            expected_note: 'A4',
            played_note: null,
            errors: ['missing'],
          },
        ],
      },
    ],
  },
}

// Capture the full navigation state on Performance Results.
function MockPerformanceResults() {
  const location = useLocation()
  const audioResult = location.state?.audioResult
  const summary = audioResult?.performance_summary

  return (
    <div>
      <h1>Performance Results Test Page</h1>

      <p>Session: {location.state?.sessionId}</p>
      <p>Score: {location.state?.scoreResult?.filename}</p>
      <p>Audio: {audioResult?.filename}</p>
      <p>Start: {location.state?.startMeasure}</p>
      <p>End: {location.state?.endMeasure}</p>

      <div data-testid="audio-result">
        {JSON.stringify(audioResult)}
      </div>

      {summary && (
        <>
          <p>
            Pitch Accuracy:
            {summary.metrics?.pitch_accuracy?.accuracy_percent}
          </p>
          <p>
            Rhythmic Accuracy:
            {summary.metrics?.rhythmic_accuracy?.accuracy_percent}
          </p>
          <p>
            Tempo Consistency:
            {summary.metrics?.tempo_consistency?.consistency_percent}
          </p>
          <p>
            Note Sequence Accuracy:
            {summary.metrics?.note_sequence_accuracy?.accuracy_percent}
          </p>
        </>
      )}
    </div>
  )
}

// Displays information passed back to Score Processing.
function MockScoreProcessing() {
  const location = useLocation()

  return (
    <div>
      <h1>Score Processing Test Page</h1>
      <p>Session: {location.state?.sessionId}</p>
      <p>Score: {location.state?.scoreResult?.filename}</p>
      <p>Start: {location.state?.startMeasure}</p>
      <p>End: {location.state?.endMeasure}</p>
    </div>
  )
}

// Valid practice session with selected measures.
const validSession = {
  sessionId: 123,
  scoreResult: mockScoreResult,
  startMeasure: 3,
  endMeasure: 6,
}

// Render the page with optional session information.
function renderPerformanceUpload(state = null) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/performance-upload',
          state,
        },
      ]}
    >
      <Routes>
        <Route
          path="/performance-upload"
          element={<PerformanceUpload />}
        />

        <Route
          path="/performance-results"
          element={<MockPerformanceResults />}
        />

        <Route
          path="/score-processing"
          element={<MockScoreProcessing />}
        />

        <Route
          path="/practice"
          element={<div>Practice Session Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

// Create a sample WAV file.
function createAudioFile() {
  return new File(
    ['sample audio'],
    'performance.wav',
    { type: 'audio/wav' }
  )
}

// Mock a successful backend response.
function mockSuccessfulUpload(audioResult = mockAudioResult) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => audioResult,
  })

  vi.stubGlobal('fetch', mockFetch)

  return mockFetch
}

// Upload a WAV file using the frontend interface.
async function uploadAudio(user) {
  await user.upload(
    screen.getByLabelText('Choose Audio File'),
    createAudioFile()
  )

  await user.click(
    screen.getByRole('button', {
      name: 'Upload Performance',
    })
  )
}

// Read the complete audio response from the mock results page.
function getTransferredAudioResult() {
  return JSON.parse(
    screen.getByTestId('audio-result').textContent
  )
}

// Restore mocks after each test.
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Performance Upload Page Tests', () => {

  // TEST 1: Verify the audio upload interface.
  test('displays the audio upload interface', () => {
    renderPerformanceUpload(validSession)

    expect(
      screen.getByRole('heading', {
        name: 'Add Your Performance',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Choose Audio File')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText('sample.musicxml')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Starting Measure')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Ending Measure')
    ).toBeInTheDocument()

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  // TEST 2: Verify selected WAV filename.
  test('displays the selected WAV filename', async () => {
    const user = userEvent.setup()

    renderPerformanceUpload(validSession)

    await user.upload(
      screen.getByLabelText('Choose Audio File'),
      createAudioFile()
    )

    expect(
      screen.getByText('performance.wav')
    ).toBeInTheDocument()
  })

  // TEST 3: Verify uploading without a file.
  test('displays an error when no audio file is selected', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn()

    vi.stubGlobal('fetch', mockFetch)

    renderPerformanceUpload(validSession)

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      screen.getByText(
        'Please choose a WAV audio file first.'
      )
    ).toBeInTheDocument()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // TEST 4: Verify upload request and navigation.
  test('uploads audio and navigates to results', async () => {
    const user = userEvent.setup()
    const mockFetch = mockSuccessfulUpload()

    renderPerformanceUpload(validSession)

    const file = createAudioFile()

    await user.upload(
      screen.getByLabelText('Choose Audio File'),
      file
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    const [uploadUrl, uploadOptions] = mockFetch.mock.calls[0]

    expect(uploadUrl).toBe(
      'http://127.0.0.1:8000/sessions/123/upload-audio'
    )

    expect(uploadOptions.method).toBe('POST')

    expect(
      uploadOptions.body.get('file')
    ).toEqual(file)

    expect(
      uploadOptions.body.get('start_measure')
    ).toBe('3')

    expect(
      uploadOptions.body.get('end_measure')
    ).toBe('6')

    expect(
      await screen.findByText('Performance Results Test Page')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Session: 123')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Score: sample.musicxml')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Audio: performance.wav')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Start: 3')
    ).toBeInTheDocument()

    expect(
      screen.getByText('End: 6')
    ).toBeInTheDocument()
  })

  // TEST 5: Verify backend error handling.
  test('displays an error when audio upload fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: 'Audio processing failed.',
      }),
    })

    vi.stubGlobal('fetch', mockFetch)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    expect(
      await screen.findByText('Audio processing failed.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // TEST 6: Verify missing session guard.
  test('displays a message when no session exists', () => {
    renderPerformanceUpload()

    expect(
      screen.getByText(
        'No active practice session or measure selection is available.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Start a Practice Session/i,
      })
    ).toBeInTheDocument()
  })

  // TEST 7: Verify navigation without session data.
  test('returns to Practice Session when data is missing', async () => {
    const user = userEvent.setup()

    renderPerformanceUpload()

    await user.click(
      screen.getByRole('button', {
        name: /Start a Practice Session/i,
      })
    )

    expect(
      screen.getByText('Practice Session Test Page')
    ).toBeInTheDocument()
  })

  // TEST 8: Verify navigation back to Score Processing.
  test('returns to Score Processing with session data', async () => {
    const user = userEvent.setup()

    renderPerformanceUpload(validSession)

    await user.click(
      screen.getByRole('button', {
        name: /Back to Score/i,
      })
    )

    expect(
      screen.getByText('Score Processing Test Page')
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

  // TEST 9: Verify default backend error.
  test('displays default error when backend returns no detail', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    vi.stubGlobal('fetch', mockFetch)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    expect(
      await screen.findByText('Audio upload failed.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // TEST 10: Verify network error handling.
  test('displays an error when the network request fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockRejectedValue(
      new Error('Failed to fetch')
    )

    vi.stubGlobal('fetch', mockFetch)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    expect(
      await screen.findByText('Failed to fetch')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    ).toBeEnabled()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // TEST 11: Verify missing measure selection.
  test('blocks upload when measure selection is missing', () => {
    renderPerformanceUpload({
      sessionId: 123,
      scoreResult: mockScoreResult,
    })

    expect(
      screen.getByText(
        'No active practice session or measure selection is available.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText('Choose Audio File')
    ).not.toBeInTheDocument()
  })

  // TEST 12: Verify a different score and measure range.
  test('displays Minuet measure selection', () => {
    renderPerformanceUpload({
      sessionId: 456,
      scoreResult: {
        filename: 'minuet_in_f.mxl',
        status: 'processed',
      },
      startMeasure: 1,
      endMeasure: 4,
    })

    expect(
      screen.getByText('minuet_in_f.mxl')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Starting Measure')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Ending Measure')
    ).toBeInTheDocument()

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  // TEST 13 - Sprint 3:
  // Verify the complete backend response is transferred.
  test('passes complete Sprint 3 audio analysis to results', async () => {
    const user = userEvent.setup()
    const mockFetch = mockSuccessfulUpload(mockSprint3AudioResult)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    expect(
      await screen.findByText('Performance Results Test Page')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)

    expect(getTransferredAudioResult()).toEqual(
      mockSprint3AudioResult
    )

    expect(
      screen.getByText('Session: 123')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Start: 3')
    ).toBeInTheDocument()

    expect(
      screen.getByText('End: 6')
    ).toBeInTheDocument()
  })

  // TEST 14 - US-14, US-15, US-16:
  // Verify all performance metrics survive navigation.
  test('passes all Sprint 3 performance metrics to results', async () => {
    const user = userEvent.setup()

    mockSuccessfulUpload(mockSprint3AudioResult)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    await screen.findByText('Performance Results Test Page')

    const metrics = getTransferredAudioResult()
      .performance_summary.metrics

    expect(metrics.pitch_accuracy).toEqual({
      accuracy_percent: 93.75,
      correct_notes: 15,
      total_expected_notes: 16,
    })

    expect(metrics.rhythmic_accuracy).toEqual({
      accuracy_percent: 92.19,
      onset_accuracy_percent: 94.5,
      duration_accuracy_percent: 89.88,
    })

    expect(metrics.tempo_consistency).toEqual({
      consistency_percent: 90.17,
      variation_percent: 9.83,
    })

    expect(metrics.note_sequence_accuracy).toEqual({
      accuracy_percent: 87.5,
      correct_notes: 14,
      total_expected_notes: 16,
    })
  })

  // TEST 15 - US-17 and US-18:
  // Verify error counts, problem areas, and locations.
  test('passes error counts and problem areas to results', async () => {
    const user = userEvent.setup()

    mockSuccessfulUpload(mockSprint3AudioResult)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    await screen.findByText('Performance Results Test Page')

    const summary = getTransferredAudioResult()
      .performance_summary

    expect(summary.error_counts).toEqual({
      incorrect_pitch: 1,
      missing_notes: 1,
      additional_notes: 0,
    })

    expect(summary.problem_areas).toHaveLength(1)

    const problemArea = summary.problem_areas[0]

    expect(problemArea.measure).toBe(4)
    expect(problemArea.total_notes).toBe(4)
    expect(problemArea.error_notes).toBe(1)
    expect(problemArea.error_rate).toBe(0.25)
    expect(problemArea.requires_practice).toBe(true)

    expect(problemArea.error_types).toEqual({
      missing: 1,
    })

    expect(problemArea.error_locations).toEqual([
      {
        beat: 2,
        expected_note: 'A4',
        played_note: null,
        errors: ['missing'],
      },
    ])

    expect(getTransferredAudioResult().note_feedback)
      .toHaveLength(1)
  })

  // TEST 16 - Sprint 3:
  // Verify backward compatibility with older responses.
  test('handles a successful response without performance summary', async () => {
    const user = userEvent.setup()

    mockSuccessfulUpload(mockAudioResult)

    renderPerformanceUpload(validSession)

    await uploadAudio(user)

    expect(
      await screen.findByText('Performance Results Test Page')
    ).toBeInTheDocument()

    const transferredResult = getTransferredAudioResult()

    expect(transferredResult.filename).toBe('performance.wav')

    expect(transferredResult.detected_pitches).toEqual([
      'C4',
      'D4',
      'E4',
    ])

    expect(
      transferredResult.performance_summary
    ).toBeUndefined()
  })

})
