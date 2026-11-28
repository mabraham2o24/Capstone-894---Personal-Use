import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

import {
  render,
  screen,
  within,
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

import PracticeHistory from '../pages/PracticeHistory.jsx'

//* ============================================================
//* MOCK PRACTICE SESSION DATA
//* ============================================================

const mockPerformanceSummary = {
  metrics: {
    pitch_accuracy: {
      accuracy_percent: 93.75,
    },
    rhythmic_accuracy: {
      accuracy_percent: 89.33,
    },
    tempo_consistency: {
      consistency_percent: 83.78,
    },
    note_sequence_accuracy: {
      accuracy_percent: 100,
    },
  },
}

const mockAIFeedback = {
  overall_assessment:
    'Your pitch accuracy is strong, but rhythmic accuracy requires improvement.',

  recommendations: [
    {
      measure: 4,
      error_type: 'late',
      exercise:
        'Practice measure 4 slowly using a metronome.',
    },
  ],

  next_session_goal:
    'Improve rhythmic accuracy to at least 95%.',
}

const mockScoreAnnotations = {
  notes: [
    {
      note_id: 'p0_m4_q1.0_A4',
      part_index: 0,
      measure: 4,
      offset_in_measure: 1.0,
      midi: 69,
      beat: 2.0,
      expected_note: 'A4',
      played_note: 'A4',
      errors: [
        {
          type: 'late',
          category: 'timing',
          description: 'Played late.',
        },
      ],
    },
  ],

  additional_notes: [
    {
      measure: 3,
      beat: 1.32,
      played_note: 'D5',
      description:
        'An extra D5 was played that is not in the score.',
    },
  ],
}

const mockSessionOne = {
  session_id: 'session-123',
  created_at: '2026-11-27T21:30:00Z',
  status: 'audio_analyzed',
  score_filename: 'canon-in-d.mxl',
  audio_filename: 'canon_late_note.wav',
  performance_summary: mockPerformanceSummary,
}

const mockSessionTwo = {
  session_id: 'session-456',
  created_at: '2026-11-26T20:15:00Z',
  status: 'audio_analyzed',
  score_filename: 'minuet.musicxml',
  audio_filename: 'minuet_correct.wav',

  performance_summary: {
    metrics: {
      pitch_accuracy: {
        accuracy_percent: 100,
      },
      rhythmic_accuracy: {
        accuracy_percent: 92.19,
      },
      tempo_consistency: {
        consistency_percent: 90.17,
      },
      note_sequence_accuracy: {
        accuracy_percent: 100,
      },
    },
  },
}

const mockSessions = [
  mockSessionOne,
  mockSessionTwo,
]

const mockSessionDetails = {
  ...mockSessionOne,

  score_summary: {
    total_measures: 16,
    total_notes: 64,
  },

  detected_pitches: [
    {
      pitch: 'A4',
      frequency: 440,
    },
  ],

  note_events: [
    {
      note: 'A4',
      start_time: 1,
      end_time: 2,
    },
  ],

  performance_analysis: {
    matched_notes: 15,
    expected_notes: 16,
  },

  note_feedback: [
    {
      measure: 4,
      expected_note: 'A4',
      played_note: 'A4',
      timing_status: 'late',
    },
  ],

  problem_areas: [
    {
      measure: 4,
      description: 'Timing requires improvement.',
    },
  ],

  score_annotations: mockScoreAnnotations,

  ai_feedback: mockAIFeedback,
}

//* ============================================================
//* TEST SETUP AND HELPER FUNCTIONS
//* ============================================================

//* Creates a mocked JSON API response.
function createJSONResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

//* Creates a pending promise for loading and cancellation tests.
function createDeferredRequest() {
  let resolve
  let reject

  const promise = new Promise(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    }
  )

  return {
    promise,
    resolve,
    reject,
  }
}

//* Mocks the practice history and session details endpoints.
function mockPracticeHistoryRequests({
  sessions = mockSessions,
  details = mockSessionDetails,
  historyHandler,
  sessionHandler,
} = {}) {
  fetch.mockImplementation(async (url, options) => {
    const requestURL = String(url)

    if (requestURL.endsWith('/sessions')) {
      if (historyHandler) {
        return historyHandler(url, options)
      }

      return createJSONResponse(sessions)
    }

    if (requestURL.includes('/sessions/')) {
      if (sessionHandler) {
        return sessionHandler(url, options)
      }

      return createJSONResponse(details)
    }

    throw new Error(
      `Unexpected API request: ${requestURL}`
    )
  })
}

//* Displays navigation state received by the results page.
function MockPerformanceResults() {
  const location = useLocation()

  return (
    <div>
      <h1>Historical Results Test Page</h1>

      <pre data-testid="historical-results-state">
        {JSON.stringify(location.state)}
      </pre>
    </div>
  )
}

//* Renders Practice History with its related navigation routes.
function renderPracticeHistory() {
  return render(
    <MemoryRouter
      initialEntries={['/practice-history']}
    >
      <Routes>
        <Route
          path="/practice-history"
          element={<PracticeHistory />}
        />

        <Route
          path="/dashboard"
          element={<h1>Dashboard Test Page</h1>}
        />

        <Route
          path="/practice"
          element={<h1>Practice Session Test Page</h1>}
        />

        <Route
          path="/performance-results"
          element={<MockPerformanceResults />}
        />
      </Routes>
    </MemoryRouter>
  )
}

//* Retrieves a session card using its score filename.
function getSessionCard(scoreFilename) {
  return screen
    .getByRole('heading', {
      name: scoreFilename,
      exact: true,
    })
    .closest('article')
}

//* Retrieves the View Results button for a specific session.
function getViewResultsButton(scoreFilename) {
  return within(
    getSessionCard(scoreFilename)
  ).getByRole('button', {
    name: 'View Results',
  })
}

//* Retrieves a particular performance metric.
function getSessionMetric(card, label) {
  return within(card)
    .getByText(label, { exact: true })
    .closest('.practice-history-metric')
}

//* Retrieves all history API requests.
function getHistoryRequests() {
  return fetch.mock.calls.filter(([url]) =>
    String(url).endsWith('/sessions')
  )
}

//* Retrieves all individual session API requests.
function getSessionRequests() {
  return fetch.mock.calls.filter(([url]) =>
    String(url).includes('/sessions/')
  )
}

//* Retrieves the state passed to Performance Results.
function getHistoricalResultsState() {
  return JSON.parse(
    screen.getByTestId(
      'historical-results-state'
    ).textContent
  )
}

//* Formats an expected date using the production date format.
function formatExpectedDate(value) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

//* Prepare a clean authenticated environment before every test.
beforeEach(() => {
  vi.stubEnv(
    'VITE_API_URL',
    'http://127.0.0.1:8000'
  )

  localStorage.setItem(
    'vmi_access_token',
    'test-access-token'
  )

  vi.stubGlobal('fetch', vi.fn())

  mockPracticeHistoryRequests()
})

//* Clean up rendered components and mocked globals.
afterEach(() => {
  cleanup()

  localStorage.clear()

  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

//* ============================================================
//* US-20 - PRACTICE HISTORY PAGE
//* ============================================================

describe('US-20 - Practice History Page', () => {

  //* TEST 1: Verify the Practice History page interface.
  test('displays the Practice History heading and description', async () => {
    renderPracticeHistory()

    expect(
      screen.getByRole('heading', {
        name: 'Practice History',
        level: 1,
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText('YOUR PRACTICE SPACE')
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Review your previous practice sessions and performance results.'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Back to Dashboard',
      })
    ).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', {
        name: 'Completed Practice Sessions',
      })
    ).toBeInTheDocument()
  })

  //* TEST 2: Verify authenticated practice history retrieval.
  test('sends an authenticated GET request for practice history', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
        signal: expect.any(AbortSignal),
      })
    )

    expect(getHistoryRequests()).toHaveLength(1)

    expect(getSessionRequests()).toHaveLength(0)
  })

  //* TEST 3: Verify the initial loading state.
  test('displays a loading message while retrieving practice history', async () => {
    const request = createDeferredRequest()

    mockPracticeHistoryRequests({
      historyHandler: () => request.promise,
    })

    renderPracticeHistory()

    expect(
      screen.getByRole('status')
    ).toHaveTextContent(
      'Loading your practice history...'
    )

    expect(
      screen.queryByRole('heading', {
        name: 'Completed Practice Sessions',
      })
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'No Practice Sessions Yet',
      })
    ).not.toBeInTheDocument()

    request.resolve(
      createJSONResponse(mockSessions)
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Completed Practice Sessions',
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('status')
    ).not.toBeInTheDocument()
  })

  //* TEST 4: Verify completed session cards.
  test('displays all completed practice sessions returned by the backend', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    const cards = screen.getAllByRole('article')

    expect(cards).toHaveLength(2)

    expect(
      getSessionCard('canon-in-d.mxl')
    ).toBeInTheDocument()

    expect(
      getSessionCard('minuet.musicxml')
    ).toBeInTheDocument()

    cards.forEach((card) => {
      expect(
        within(card).getByText('Completed')
      ).toBeInTheDocument()

      expect(
        within(card).getByRole('button', {
          name: 'View Results',
        })
      ).toBeEnabled()
    })
  })

  //* TEST 5: Verify the plural session count.
  test('displays the correct count for multiple practice sessions', async () => {
    renderPracticeHistory()

    expect(
      await screen.findByText('2 sessions', {
        exact: true,
      })
    ).toBeInTheDocument()
  })

  //* TEST 6: Verify the singular session count.
  test('displays the correct count for one practice session', async () => {
    mockPracticeHistoryRequests({
      sessions: [mockSessionOne],
    })

    renderPracticeHistory()

    expect(
      await screen.findByText('1 session', {
        exact: true,
      })
    ).toBeInTheDocument()

    expect(
      screen.getAllByRole('article')
    ).toHaveLength(1)
  })

  //* TEST 7: Verify backend-provided session ordering.
  test('preserves the newest-first ordering returned by the backend', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    const cards = screen.getAllByRole('article')

    expect(
      within(cards[0]).getByRole('heading', {
        name: 'canon-in-d.mxl',
      })
    ).toBeInTheDocument()

    expect(
      within(cards[1]).getByRole('heading', {
        name: 'minuet.musicxml',
      })
    ).toBeInTheDocument()
  })

  //* TEST 8: Verify saved score and recording filenames.
  test('displays the correct score and recording filenames for each session', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    const firstCard = getSessionCard('canon-in-d.mxl')
    const secondCard = getSessionCard('minuet.musicxml')

    expect(
      within(firstCard).getByText('Performance Recording')
    ).toBeInTheDocument()

    expect(
      within(firstCard).getByText('canon_late_note.wav')
    ).toBeInTheDocument()

    expect(
      within(secondCard).getByText('minuet_correct.wav')
    ).toBeInTheDocument()
  })

  //* TEST 9: Verify saved practice dates.
  test('displays the formatted practice date for each session', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    expect(
      within(
        getSessionCard('canon-in-d.mxl')
      ).getByText(
        formatExpectedDate(mockSessionOne.created_at)
      )
    ).toBeInTheDocument()

    expect(
      within(
        getSessionCard('minuet.musicxml')
      ).getByText(
        formatExpectedDate(mockSessionTwo.created_at)
      )
    ).toBeInTheDocument()
  })

  //* TEST 10: Verify missing and invalid practice dates.
  test('displays Date unavailable for missing or invalid practice dates', async () => {
    mockPracticeHistoryRequests({
      sessions: [
        {
          ...mockSessionOne,
          created_at: null,
        },
        {
          ...mockSessionTwo,
          created_at: 'invalid-date',
        },
      ],
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    expect(
      screen.getAllByText('Date unavailable')
    ).toHaveLength(2)

    expect(
      screen.queryByText('Invalid Date')
    ).not.toBeInTheDocument()
  })

  //* TEST 11: Verify missing filename handling.
  test('displays fallback labels when score or audio filenames are missing', async () => {
    mockPracticeHistoryRequests({
      sessions: [
        {
          ...mockSessionOne,
          score_filename: null,
          audio_filename: null,
        },
      ],
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('heading', {
        name: 'Unknown Score',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText('Filename unavailable')
    ).toBeInTheDocument()
  })

  //* TEST 12: Verify saved performance metrics.
  test('displays all four saved performance accuracy metrics', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    const card = getSessionCard('canon-in-d.mxl')

    const expectedMetrics = [
      ['Pitch Accuracy', '93.75%'],
      ['Rhythmic Accuracy', '89.33%'],
      ['Tempo Consistency', '83.78%'],
      ['Note Sequence Accuracy', '100.00%'],
    ]

    expectedMetrics.forEach(([label, value]) => {
      expect(
        within(
          getSessionMetric(card, label)
        ).getByText(value)
      ).toBeInTheDocument()
    })
  })

  //* TEST 13: Verify that metrics remain associated with the correct session.
  test('displays session-specific performance metrics', async () => {
    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    const firstCard = getSessionCard('canon-in-d.mxl')
    const secondCard = getSessionCard('minuet.musicxml')

    expect(
      within(
        getSessionMetric(firstCard, 'Pitch Accuracy')
      ).getByText('93.75%')
    ).toBeInTheDocument()

    expect(
      within(
        getSessionMetric(secondCard, 'Pitch Accuracy')
      ).getByText('100.00%')
    ).toBeInTheDocument()

    expect(
      within(
        getSessionMetric(secondCard, 'Tempo Consistency')
      ).getByText('90.17%')
    ).toBeInTheDocument()
  })

  //* TEST 14: Verify zero and unavailable metric values.
  test('preserves valid zero percentages and displays N/A for invalid metrics', async () => {
    mockPracticeHistoryRequests({
      sessions: [
        {
          ...mockSessionOne,

          performance_summary: {
            metrics: {
              pitch_accuracy: {
                accuracy_percent: 0,
              },
              rhythmic_accuracy: {
                accuracy_percent: null,
              },
              tempo_consistency: {
                consistency_percent: '90',
              },
              note_sequence_accuracy: {
                accuracy_percent: Infinity,
              },
            },
          },
        },
      ],
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    const card = getSessionCard('canon-in-d.mxl')

    expect(
      within(
        getSessionMetric(card, 'Pitch Accuracy')
      ).getByText('0.00%')
    ).toBeInTheDocument()

    expect(
      within(card).getAllByText('N/A')
    ).toHaveLength(3)
  })

  //* TEST 15: Verify missing performance summaries.
  test('displays N/A for all metrics when a performance summary is missing', async () => {
    mockPracticeHistoryRequests({
      sessions: [
        {
          ...mockSessionOne,
          performance_summary: null,
        },
      ],
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    expect(
      within(
        getSessionCard('canon-in-d.mxl')
      ).getAllByText('N/A')
    ).toHaveLength(4)
  })

  //* TEST 16: Verify the empty practice history interface.
  test('displays an appropriate empty state when no practice sessions exist', async () => {
    mockPracticeHistoryRequests({
      sessions: [],
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('heading', {
        name: 'No Practice Sessions Yet',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /You have not completed any practice sessions yet/
      )
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Start Practice Session',
      })
    ).toBeEnabled()

    expect(
      screen.queryAllByRole('article')
    ).toHaveLength(0)

    expect(
      screen.queryByRole('alert')
    ).not.toBeInTheDocument()
  })

  //* TEST 17: Verify Start Practice Session navigation.
  test('navigates to the practice page from the empty history state', async () => {
    const user = userEvent.setup()

    mockPracticeHistoryRequests({
      sessions: [],
    })

    renderPracticeHistory()

    await user.click(
      await screen.findByRole('button', {
        name: 'Start Practice Session',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Practice Session Test Page',
      })
    ).toBeInTheDocument()
  })

  //* TEST 18: Verify Back to Dashboard navigation.
  test('returns to the dashboard using the Back to Dashboard button', async () => {
    const user = userEvent.setup()

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Back to Dashboard',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Dashboard Test Page',
      })
    ).toBeInTheDocument()
  })
})

//* ============================================================
//* US-20 - PRACTICE HISTORY ERROR HANDLING
//* ============================================================

describe('US-20 - Practice History Error Handling', () => {

  //* TEST 19: Verify backend error messages.
  test('displays the backend error when practice history retrieval fails', async () => {
    mockPracticeHistoryRequests({
      historyHandler: () =>
        createJSONResponse(
          {
            detail:
              'Unable to access saved practice sessions.',
          },
          500
        ),
    })

    renderPracticeHistory()

    const alert = await screen.findByRole('alert')

    expect(
      within(alert).getByRole('heading', {
        name: 'Unable to Load Practice History',
      })
    ).toBeInTheDocument()

    expect(alert).toHaveTextContent(
      'Unable to access saved practice sessions.'
    )

    expect(
      within(alert).getByRole('button', {
        name: 'Try Again',
      })
    ).toBeEnabled()

    expect(
      screen.queryAllByRole('article')
    ).toHaveLength(0)
  })

  //* TEST 20: Verify the default backend error message.
  test('displays a default error when the backend provides no error details', async () => {
    mockPracticeHistoryRequests({
      historyHandler: () =>
        createJSONResponse({}, 500),
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'Unable to retrieve your practice history. Please try again.'
    )
  })

  //* TEST 21: Verify network error handling.
  test('displays a connection error when practice history retrieval fails', async () => {
    mockPracticeHistoryRequests({
      historyHandler: () => {
        throw new TypeError('Failed to fetch')
      },
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'Unable to connect to the backend. Please check your connection and try again.'
    )

    expect(
      screen.queryByRole('status')
    ).not.toBeInTheDocument()
  })

  //* TEST 22: Verify invalid response structure handling.
  test('rejects a practice history response that is not an array', async () => {
    mockPracticeHistoryRequests({
      historyHandler: () =>
        createJSONResponse({
          sessions: mockSessions,
        }),
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'An invalid practice history response was returned. Please try again.'
    )

    expect(
      screen.queryAllByRole('article')
    ).toHaveLength(0)
  })

  //* TEST 23: Verify invalid JSON response handling.
  test('handles an unreadable JSON practice history response', async () => {
    mockPracticeHistoryRequests({
      historyHandler: () => ({
        ok: true,
        status: 200,

        json: async () => {
          throw new SyntaxError('Invalid JSON')
        },
      }),
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'An invalid practice history response was returned. Please try again.'
    )
  })

  //* TEST 24: Verify successful retry after a history retrieval failure.
  test('retrieves practice history successfully after clicking Try Again', async () => {
    const user = userEvent.setup()

    let requestCount = 0

    mockPracticeHistoryRequests({
      historyHandler: () => {
        requestCount += 1

        if (requestCount === 1) {
          return createJSONResponse(
            {
              detail:
                'Practice history temporarily unavailable.',
            },
            500
          )
        }

        return createJSONResponse(mockSessions)
      },
    })

    renderPracticeHistory()

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'Practice history temporarily unavailable.'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Try Again',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Completed Practice Sessions',
      })
    ).toBeInTheDocument()

    expect(
      screen.getAllByRole('article')
    ).toHaveLength(2)

    expect(
      screen.queryByRole('alert')
    ).not.toBeInTheDocument()

    expect(getHistoryRequests()).toHaveLength(2)
  })

  //* TEST 25: Verify cancellation of unfinished history requests.
  test('aborts the practice history request when the page unmounts', async () => {
    const request = createDeferredRequest()

    let requestSignal

    mockPracticeHistoryRequests({
      historyHandler: (url, options) => {
        requestSignal = options.signal

        return request.promise
      },
    })

    const { unmount } = renderPracticeHistory()

    await waitFor(() => {
      expect(requestSignal).toBeDefined()
    })

    expect(requestSignal.aborted).toBe(false)

    unmount()

    expect(requestSignal.aborted).toBe(true)

    request.resolve(
      createJSONResponse(mockSessions)
    )
  })
})

//* ============================================================
//* US-20 - HISTORICAL SESSION RETRIEVAL
//* ============================================================

describe('US-20 - Historical Session Retrieval', () => {

  //* TEST 26: Verify authenticated session details retrieval.
  test('requests the selected session using its ID and access token', async () => {
    const user = userEvent.setup()

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Historical Results Test Page',
      })
    ).toBeInTheDocument()

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions/session-123',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
        signal: expect.any(AbortSignal),
      })
    )

    expect(getSessionRequests()).toHaveLength(1)
  })

  //* TEST 27: Verify selection of a different practice session.
  test('retrieves the correct details when the second session is selected', async () => {
    const user = userEvent.setup()

    mockPracticeHistoryRequests({
      details: {
        ...mockSessionDetails,
        ...mockSessionTwo,
      },
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('minuet.musicxml')
    )

    await screen.findByRole('heading', {
      name: 'Historical Results Test Page',
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/sessions/session-456',
      expect.any(Object)
    )

    const state = getHistoricalResultsState()

    expect(state.sessionId).toBe('session-456')

    expect(
      state.scoreResult.filename
    ).toBe('minuet.musicxml')

    expect(
      state.audioResult.filename
    ).toBe('minuet_correct.wav')

    expect(
      state.audioResult.performance_summary
    ).toEqual(
      mockSessionTwo.performance_summary
    )
  })

  //* TEST 28: Verify historical results navigation and complete data mapping.
  test('passes the saved session information to the Performance Results page', async () => {
    const user = userEvent.setup()

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    await screen.findByRole('heading', {
      name: 'Historical Results Test Page',
    })

    const state = getHistoricalResultsState()

    expect(state).toEqual({
      sessionId: 'session-123',

      scoreResult: {
        session_id: 'session-123',
        filename: 'canon-in-d.mxl',
        status: 'score_uploaded',
        summary: mockSessionDetails.score_summary,
      },

      audioResult: {
        session_id: 'session-123',
        filename: 'canon_late_note.wav',
        status: 'audio_analyzed',

        detected_pitches:
          mockSessionDetails.detected_pitches,

        note_events:
          mockSessionDetails.note_events,

        performance_analysis:
          mockSessionDetails.performance_analysis,

        performance_summary:
          mockSessionDetails.performance_summary,

        note_feedback:
          mockSessionDetails.note_feedback,

        problem_areas:
          mockSessionDetails.problem_areas,

        score_annotations:
          mockScoreAnnotations,

        ai_feedback:
          mockAIFeedback,
      },

      startMeasure: null,
      endMeasure: null,
      performanceAudioFile: null,
      isHistoricalSession: true,

      practiceDate: mockSessionDetails.created_at,
    })

    //* Only the history and selected session are requested.
    //* No score upload or performance reanalysis occurs.
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  //* TEST 29: Verify missing optional historical data.
  test('provides safe default values for missing optional session data', async () => {
    const user = userEvent.setup()

    mockPracticeHistoryRequests({
      details: {
        ...mockSessionOne,
        score_summary: {},
      },
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    await screen.findByRole('heading', {
      name: 'Historical Results Test Page',
    })

    const state = getHistoricalResultsState()

    expect(
      state.audioResult.detected_pitches
    ).toEqual([])

    expect(
      state.audioResult.note_events
    ).toEqual([])

    expect(
      state.audioResult.note_feedback
    ).toEqual([])

    expect(
      state.audioResult.problem_areas
    ).toEqual([])

    expect(
      state.audioResult.score_annotations
    ).toBeNull()

    expect(
      state.audioResult.ai_feedback
    ).toBeNull()

    expect(
      state.isHistoricalSession
    ).toBe(true)
  })

  //* TEST 30: Verify loading states and duplicate request prevention.
  test('disables all View Results buttons while retrieving a selected session', async () => {
    const user = userEvent.setup()

    const request = createDeferredRequest()

    mockPracticeHistoryRequests({
      sessionHandler: () => request.promise,
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    const selectedCard = getSessionCard('canon-in-d.mxl')
    const otherCard = getSessionCard('minuet.musicxml')

    const loadingButton =
      within(selectedCard).getByRole('button', {
        name: 'Loading Results...',
      })

    const otherButton =
      within(otherCard).getByRole('button', {
        name: 'View Results',
      })

    expect(loadingButton).toBeDisabled()

    expect(otherButton).toBeDisabled()

    expect(
      within(selectedCard).getByRole('status')
    ).toHaveTextContent(
      'Retrieving saved performance results...'
    )

    await user.click(loadingButton)
    await user.click(otherButton)

    expect(getSessionRequests()).toHaveLength(1)

    request.resolve(
      createJSONResponse(mockSessionDetails)
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Historical Results Test Page',
      })
    ).toBeInTheDocument()
  })

  //* TEST 31: Verify unavailable or unauthorized session handling.
  test('displays an error when the selected session cannot be retrieved', async () => {
    const user = userEvent.setup()

    mockPracticeHistoryRequests({
      sessionHandler: () =>
        createJSONResponse(
          {
            detail: 'Session not found',
          },
          404
        ),
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    const alert = await screen.findByRole('alert')

    expect(
      within(alert).getByRole('heading', {
        name: 'Unable to Load Session',
      })
    ).toBeInTheDocument()

    expect(alert).toHaveTextContent(
      'Session not found'
    )

    expect(alert).toHaveTextContent(
      'Select View Results to try again.'
    )

    expect(
      screen.getAllByRole('article')
    ).toHaveLength(2)

    expect(
      getViewResultsButton('canon-in-d.mxl')
    ).toBeEnabled()

    expect(
      screen.queryByRole('heading', {
        name: 'Historical Results Test Page',
      })
    ).not.toBeInTheDocument()
  })

  //* TEST 32: Verify selected session network error handling.
  test('displays a connection error when session details retrieval fails', async () => {
    const user = userEvent.setup()

    mockPracticeHistoryRequests({
      sessionHandler: () => {
        throw new TypeError('Failed to fetch')
      },
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'Unable to connect to the backend. Please check your connection and try again.'
    )

    expect(
      getViewResultsButton('canon-in-d.mxl')
    ).toBeEnabled()

    expect(
      getViewResultsButton('minuet.musicxml')
    ).toBeEnabled()

    expect(
      screen.queryByRole('status')
    ).not.toBeInTheDocument()
  })

  //* TEST 33: Verify invalid saved performance results.
  test('rejects session details that do not contain valid saved performance results', async () => {
    const user = userEvent.setup()

    const invalidResponses = [
      {
        ...mockSessionDetails,
        session_id: 'different-session',
      },
      {
        ...mockSessionDetails,
        status: 'score_uploaded',
      },
      {
        ...mockSessionDetails,
        performance_summary: null,
      },
      null,
    ]

    let requestCount = 0

    mockPracticeHistoryRequests({
      sessionHandler: () => {
        const response =
          invalidResponses[requestCount]

        requestCount += 1

        return createJSONResponse(response)
      },
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    for (
      let index = 0;
      index < invalidResponses.length;
      index += 1
    ) {
      await user.click(
        getViewResultsButton('canon-in-d.mxl')
      )

      expect(
        await screen.findByRole('alert')
      ).toHaveTextContent(
        'The selected session does not contain valid saved performance results.'
      )

      expect(
        getViewResultsButton('canon-in-d.mxl')
      ).toBeEnabled()

      expect(
        screen.queryByRole('heading', {
          name: 'Historical Results Test Page',
        })
      ).not.toBeInTheDocument()
    }

    expect(getSessionRequests()).toHaveLength(4)
  })

  //* TEST 34: Verify successful retry after a session retrieval error.
  test('allows a failed historical session request to be retried successfully', async () => {
    const user = userEvent.setup()

    let requestCount = 0

    mockPracticeHistoryRequests({
      sessionHandler: () => {
        requestCount += 1

        if (requestCount === 1) {
          return createJSONResponse(
            {
              detail:
                'Session temporarily unavailable.',
            },
            500
          )
        }

        return createJSONResponse(mockSessionDetails)
      },
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent(
      'Session temporarily unavailable.'
    )

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Historical Results Test Page',
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('alert')
    ).not.toBeInTheDocument()

    expect(getSessionRequests()).toHaveLength(2)

    expect(
      getHistoricalResultsState().sessionId
    ).toBe('session-123')
  })

  //* TEST 35: Verify cancellation of unfinished session requests.
  test('aborts a pending session details request when leaving Practice History', async () => {
    const user = userEvent.setup()

    const request = createDeferredRequest()

    let requestSignal

    mockPracticeHistoryRequests({
      sessionHandler: (url, options) => {
        requestSignal = options.signal

        return request.promise
      },
    })

    renderPracticeHistory()

    await screen.findByRole('heading', {
      name: 'Completed Practice Sessions',
    })

    await user.click(
      getViewResultsButton('canon-in-d.mxl')
    )

    await waitFor(() => {
      expect(requestSignal).toBeDefined()
    })

    expect(requestSignal.aborted).toBe(false)

    await user.click(
      screen.getByRole('button', {
        name: 'Back to Dashboard',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Dashboard Test Page',
      })
    ).toBeInTheDocument()

    expect(requestSignal.aborted).toBe(true)

    request.resolve(
      createJSONResponse(mockSessionDetails)
    )

    expect(
      screen.queryByRole('heading', {
        name: 'Historical Results Test Page',
      })
    ).not.toBeInTheDocument()
  })
})