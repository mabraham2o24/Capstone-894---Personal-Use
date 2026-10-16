
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

// Displays the information passed to Performance Results.
function MockPerformanceResults() {
  const location = useLocation()

  return (
    <div>
      <h1>Performance Results Test Page</h1>
      <p>Session: {location.state?.sessionId}</p>
      <p>Score: {location.state?.scoreResult?.filename}</p>
      <p>Audio: {location.state?.audioResult?.filename}</p>
      <p>Start: {location.state?.startMeasure}</p>
      <p>End: {location.state?.endMeasure}</p>
    </div>
  )
}

// Displays the information passed back to Score Processing.
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

// Valid Sprint 2 practice session with selected measures.
const validSession = {
  sessionId: 123,
  scoreResult: mockScoreResult,
  startMeasure: 3,
  endMeasure: 6,
}

// Renders the page with or without session information.
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

// Creates a sample WAV file for testing.
function createAudioFile() {
  return new File(
    ['sample audio'],
    'performance.wav',
    { type: 'audio/wav' }
  )
}

// Restores mocked functions after each test.
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Performance Upload Page Tests', () => {

  // Test 1: Verify the audio upload interface.
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

    // Sprint 2: Verify the selected measure range.
    expect(
      screen.getByText('Starting Measure')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Ending Measure')
    ).toBeInTheDocument()

    expect(
      screen.getByText('3')
    ).toBeInTheDocument()

    expect(
      screen.getByText('6')
    ).toBeInTheDocument()
  })

  // Test 2: Verify that selecting a WAV file
  // displays the filename.
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

  // Test 3: Verify that uploading without
  // selecting a file displays an error.
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

  // Test 4: Verify successful WAV upload,
  // selected measures, and navigation.
  test('uploads audio and navigates to results', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAudioResult,
    })

    vi.stubGlobal('fetch', mockFetch)

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

    const [uploadUrl, uploadOptions] =
      mockFetch.mock.calls[0]

    expect(uploadUrl).toBe(
      'http://127.0.0.1:8000/sessions/123/upload-audio'
    )

    expect(uploadOptions.method).toBe('POST')

    // Verify that the selected WAV file was sent.
    expect(
      uploadOptions.body.get('file')
    ).toEqual(file)

    // Sprint 2: Verify the selected measures
    // were included in the backend request.
    expect(
      uploadOptions.body.get('start_measure')
    ).toBe('3')

    expect(
      uploadOptions.body.get('end_measure')
    ).toBe('6')

    // Verify navigation and transferred information.
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

  // Test 5: Verify backend error handling.
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

    await user.upload(
      screen.getByLabelText('Choose Audio File'),
      createAudioFile()
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      await screen.findByText('Audio processing failed.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // Test 6: Verify the missing session guard.
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

  // Test 7: Verify navigation when no session exists.
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

  // Test 8: Verify navigation back to Score Processing
  // while preserving session and measure information.
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

  // Test 9: Verify the default error message
  // when the backend does not provide details.
  test('displays default error when backend returns no detail', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    vi.stubGlobal('fetch', mockFetch)

    renderPerformanceUpload(validSession)

    await user.upload(
      screen.getByLabelText('Choose Audio File'),
      createAudioFile()
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

    expect(
      await screen.findByText('Audio upload failed.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // Test 10: Verify handling of network errors
  // when the backend cannot be reached.
  test('displays an error when the network request fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockRejectedValue(
      new Error('Failed to fetch')
    )

    vi.stubGlobal('fetch', mockFetch)

    renderPerformanceUpload(validSession)

    await user.upload(
      screen.getByLabelText('Choose Audio File'),
      createAudioFile()
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Upload Performance',
      })
    )

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

  // Test 11: Verify that the upload interface
  // is blocked when measure selection is missing.
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

  // Test 12: Verify the upload interface
  // displays a different valid measure range.
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

    expect(
      screen.getByText('1')
    ).toBeInTheDocument()

    expect(
      screen.getByText('4')
    ).toBeInTheDocument()
  })

})
