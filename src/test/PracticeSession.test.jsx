
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'

import PracticeSession from '../pages/PracticeSession.jsx'

// Sample MusicXML response returned by FastAPI.
const mockScoreResult = {
  filename: 'sample.musicxml',
  status: 'processed',
  summary: {
    total_notes_detected: 16,
    num_measures: 4,
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

// Mock Score Results page.
// Displays navigation state passed from Practice Session.
function MockScoreProcessing() {
  const location = useLocation()
  const scoreResult = location.state?.scoreResult

  return (
    <div>
      <h1>Score Processing Test Page</h1>

      <p>Session: {location.state?.sessionId}</p>
      <p>File: {scoreResult?.filename}</p>

      <div data-testid="score-result">
        {JSON.stringify(scoreResult)}
      </div>
    </div>
  )
}

// Render Practice Session with routing enabled.
function renderPracticeSession() {
  return render(
    <MemoryRouter initialEntries={['/practice']}>
      <Routes>
        <Route
          path="/practice"
          element={<PracticeSession />}
        />

        <Route
          path="/score-processing"
          element={<MockScoreProcessing />}
        />

        <Route
          path="/dashboard"
          element={<div>Dashboard Test Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

// Create a sample MusicXML file.
function createMusicXMLFile() {
  return new File(
    ['<score-partwise></score-partwise>'],
    'sample.musicxml',
    { type: 'application/xml' }
  )
}

// Mock successful session creation and score upload.
function mockSuccessfulScoreUpload(
  scoreResult = mockScoreResult
) {
  const mockFetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_id: 123,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => scoreResult,
    })

  vi.stubGlobal('fetch', mockFetch)

  return mockFetch
}

// Select a MusicXML file and click Upload Score.
async function uploadScore(user, file = createMusicXMLFile()) {
  await user.upload(
    screen.getByLabelText('Choose MusicXML File'),
    file
  )

  await user.click(
    screen.getByRole('button', {
      name: /Upload Score/i,
    })
  )
}

// Read the complete score response transferred to Score Results.
function getTransferredScoreResult() {
  return JSON.parse(
    screen.getByTestId('score-result').textContent
  )
}

// Restore mocked functions after each test.
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Practice Session Page Tests', () => {

  // TEST 1: Verify the MusicXML upload interface.
  test('displays the MusicXML upload interface', () => {
    renderPracticeSession()

    expect(
      screen.getByRole('heading', {
        name: 'New Practice Session',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Choose MusicXML File')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Upload Score/i,
      })
    ).toBeInTheDocument()
  })

  // TEST 2: Verify selected filename.
  test('displays the selected MusicXML filename', async () => {
    const user = userEvent.setup()

    renderPracticeSession()

    await user.upload(
      screen.getByLabelText('Choose MusicXML File'),
      createMusicXMLFile()
    )

    expect(
      screen.getByText('sample.musicxml')
    ).toBeInTheDocument()
  })

  // TEST 3: Verify upload without selecting a file.
  test('displays an error when no file is selected', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn()

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await user.click(
      screen.getByRole('button', {
        name: /Upload Score/i,
      })
    )

    expect(
      screen.getByText(
        'Please choose a MusicXML file first.'
      )
    ).toBeInTheDocument()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // TEST 4: Verify session creation and MusicXML upload.
  test('creates a session and uploads MusicXML successfully', async () => {
    const user = userEvent.setup()
    const mockFetch = mockSuccessfulScoreUpload()

    renderPracticeSession()

    const file = createMusicXMLFile()

    await uploadScore(user, file)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    // Verify session creation.
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8000/sessions',
      { method: 'POST' }
    )

    // Verify score upload request.
    const [uploadUrl, uploadOptions] =
      mockFetch.mock.calls[1]

    expect(uploadUrl).toBe(
      'http://127.0.0.1:8000/sessions/123/upload-score'
    )

    expect(uploadOptions.method).toBe('POST')

    expect(
      uploadOptions.body.get('file')
    ).toEqual(file)

    // Verify navigation.
    expect(
      await screen.findByText('Score Processing Test Page')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Session: 123')
    ).toBeInTheDocument()

    expect(
      screen.getByText('File: sample.musicxml')
    ).toBeInTheDocument()
  })

  // TEST 5: Verify session creation failure.
  test('displays an error when session creation fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    })

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await uploadScore(user)

    expect(
      await screen.findByText(
        'Could not create a practice session.'
      )
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // TEST 6: Verify MusicXML upload failure.
  test('displays an error when MusicXML upload fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 123,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          detail: 'Invalid MusicXML file.',
        }),
      })

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    const file = new File(
      ['invalid MusicXML'],
      'invalid.musicxml',
      { type: 'application/xml' }
    )

    await uploadScore(user, file)

    expect(
      await screen.findByText('Invalid MusicXML file.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // TEST 7: Verify Dashboard navigation.
  test('navigates back to Dashboard', async () => {
    const user = userEvent.setup()

    renderPracticeSession()

    await user.click(
      screen.getByRole('button', {
        name: /Back to Dashboard/i,
      })
    )

    expect(
      screen.getByText('Dashboard Test Page')
    ).toBeInTheDocument()
  })

  // TEST 8: Verify default upload error.
  test('displays default error when score upload fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 123,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await uploadScore(user)

    expect(
      await screen.findByText('Score upload failed.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // TEST 9: Verify network error handling.
  test('displays an error when the network request fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockRejectedValue(
      new Error('Failed to fetch')
    )

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await uploadScore(user)

    expect(
      await screen.findByText('Failed to fetch')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Upload Score/i,
      })
    ).toBeEnabled()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // TEST 10: Verify complete score summary transfer.
  test('passes complete MusicXML summary to Score Results', async () => {
    const user = userEvent.setup()

    mockSuccessfulScoreUpload()

    renderPracticeSession()

    await uploadScore(user)

    expect(
      await screen.findByText('Score Processing Test Page')
    ).toBeInTheDocument()

    expect(getTransferredScoreResult()).toEqual(
      mockScoreResult
    )

    const summary = getTransferredScoreResult().summary

    expect(summary.total_notes_detected).toBe(16)
    expect(summary.num_measures).toBe(4)
    expect(summary.tempo_bpm).toBe(120)
  })

  // TEST 11: Verify extracted note preview transfer.
  test('passes extracted notes to Score Results', async () => {
    const user = userEvent.setup()

    mockSuccessfulScoreUpload()

    renderPracticeSession()

    await uploadScore(user)

    await screen.findByText('Score Processing Test Page')

    const notes = getTransferredScoreResult()
      .summary.first_notes_preview

    expect(notes).toHaveLength(4)

    expect(notes[0]).toEqual({
      pitches: ['C4'],
      duration_quarterLength: 1,
      offset: 0,
    })

    expect(notes[3]).toEqual({
      pitches: ['F4'],
      duration_quarterLength: 1,
      offset: 3,
    })
  })

  // TEST 12: Verify backward compatibility with older responses.
  test('handles score responses without detailed summary', async () => {
    const user = userEvent.setup()

    const basicScoreResult = {
      filename: 'sample.musicxml',
      status: 'processed',
    }

    mockSuccessfulScoreUpload(basicScoreResult)

    renderPracticeSession()

    await uploadScore(user)

    expect(
      await screen.findByText('Score Processing Test Page')
    ).toBeInTheDocument()

    const transferredResult = getTransferredScoreResult()

    expect(transferredResult.filename).toBe('sample.musicxml')
    expect(transferredResult.status).toBe('processed')
    expect(transferredResult.summary).toBeUndefined()
  })

})
