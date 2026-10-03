
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

// Displays the information passed to the Score Processing page.
function MockScoreProcessing() {
  const location = useLocation()

  return (
    <div>
      <h1>Score Processing Test Page</h1>
      <p>Session: {location.state?.sessionId}</p>
      <p>File: {location.state?.scoreResult?.filename}</p>
    </div>
  )
}

// Renders the Practice Session page with routing enabled.
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

// Creates a sample MusicXML file for testing.
function createMusicXMLFile() {
  return new File(
    ['<score-partwise></score-partwise>'],
    'sample.musicxml',
    { type: 'application/xml' }
  )
}

// Restores mocked functions after each test.
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Practice Session Page Tests', () => {

  // Test 1: Verify the MusicXML upload interface.
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
      screen.getByRole('button', { name: 'Upload Score' })
    ).toBeInTheDocument()
  })

  // Test 2: Verify that selecting a file displays its name.
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

  // Test 3: Verify that uploading without a file
  // displays an error and does not contact the backend.
  test('displays an error when no file is selected', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn()

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await user.click(
      screen.getByRole('button', { name: 'Upload Score' })
    )

    expect(
      screen.getByText('Please choose a MusicXML file first.')
    ).toBeInTheDocument()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // Test 4: Verify session creation and MusicXML upload.
  test('creates a session and uploads MusicXML successfully', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 123,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filename: 'sample.musicxml',
          status: 'processed',
        }),
      })

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    const file = createMusicXMLFile()

    await user.upload(
      screen.getByLabelText('Choose MusicXML File'),
      file
    )

    await user.click(
      screen.getByRole('button', { name: 'Upload Score' })
    )

    // Verify that the session creation request was sent.
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8000/sessions',
      { method: 'POST' }
    )

    // Verify that the MusicXML file was uploaded.
    const [uploadUrl, uploadOptions] =
      mockFetch.mock.calls[1]

    expect(uploadUrl).toBe(
      'http://127.0.0.1:8000/sessions/123/upload-score'
    )

    expect(uploadOptions.method).toBe('POST')

    expect(
      uploadOptions.body.get('file')
    ).toEqual(file)

    // Verify navigation and transferred session data.
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

  // Test 5: Verify error handling if session creation fails.
  test('displays an error when session creation fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    })

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await user.upload(
      screen.getByLabelText('Choose MusicXML File'),
      createMusicXMLFile()
    )

    await user.click(
      screen.getByRole('button', { name: 'Upload Score' })
    )

    expect(
      await screen.findByText(
        'Could not create a practice session.'
      )
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // Test 6: Verify error handling if MusicXML upload fails.
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

    await user.upload(
      screen.getByLabelText('Choose MusicXML File'),
      file
    )

    await user.click(
      screen.getByRole('button', { name: 'Upload Score' })
    )

    expect(
      await screen.findByText('Invalid MusicXML file.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // Test 7: Verify navigation back to Dashboard.
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

  // Test 8: Verify the default error message when
  // the backend rejects an upload without details.
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

    await user.upload(
      screen.getByLabelText('Choose MusicXML File'),
      createMusicXMLFile()
    )

    await user.click(
      screen.getByRole('button', { name: 'Upload Score' })
    )

    expect(
      await screen.findByText('Score upload failed.')
    ).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // Test 9: Verify network error handling.
  test('displays an error when the network request fails', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockRejectedValue(
      new Error('Failed to fetch')
    )

    vi.stubGlobal('fetch', mockFetch)

    renderPracticeSession()

    await user.upload(
      screen.getByLabelText('Choose MusicXML File'),
      createMusicXMLFile()
    )

    await user.click(
      screen.getByRole('button', { name: 'Upload Score' })
    )

    expect(
      await screen.findByText('Failed to fetch')
    ).toBeInTheDocument()

    // Verify that the upload button is enabled again.
    expect(
      screen.getByRole('button', {
        name: 'Upload Score',
      })
    ).toBeEnabled()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

})
