import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { authFetch } from '../auth.js'

// Formats saved performance metrics while preserving valid 0% scores.
function formatPercentage(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'N/A'
  }

  return `${value.toFixed(2)}%`
}

// Formats the saved practice session date and time.
function formatPracticeDate(value) {
  if (!value) {
    return 'Date unavailable'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PracticeHistory() {
  const navigate = useNavigate()

  // Practice history state
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  // Individual session retrieval state
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionError, setSessionError] = useState('')

  // Allows an unfinished session request to be cancelled.
  const sessionRequestRef = useRef(null)

  // Retrieves the authenticated user's completed practice sessions.
  useEffect(() => {
    const controller = new AbortController()

    const fetchPracticeHistory = async () => {
      setLoading(true)
      setError('')
      setSessionError('')

      try {
        const response = await authFetch('/sessions', {
          method: 'GET',
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.detail === 'string'
              ? data.detail
              : 'Unable to retrieve your practice history. Please try again.'
          )
        }

        if (!Array.isArray(data)) {
          throw new Error(
            'An invalid practice history response was returned. Please try again.'
          )
        }

        if (!controller.signal.aborted) {
          setSessions(data)
        }
      } catch (requestError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          requestError instanceof TypeError
            ? 'Unable to connect to the backend. Please check your connection and try again.'
            : requestError.message ||
                'Unable to retrieve your practice history.'
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchPracticeHistory()

    return () => {
      controller.abort()
    }
  }, [retryCount])

  // Cancels an individual session request when leaving this page.
  useEffect(() => {
    return () => {
      sessionRequestRef.current?.abort()
    }
  }, [])

  // Retrieves the detailed results of a previously completed session.
  const handleViewResults = async (sessionId) => {
    if (!sessionId || sessionRequestRef.current) {
      return
    }

    const controller = new AbortController()
    sessionRequestRef.current = controller

    setSelectedSessionId(sessionId)
    setSessionError('')

    try {
      const response = await authFetch(
        `/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : 'Unable to retrieve the selected practice session. Please try again.'
        )
      }

      // Ensures the selected session contains saved analysis results.
      if (
        !data ||
        data.session_id !== sessionId ||
        data.status !== 'audio_analyzed' ||
        !data.performance_summary
      ) {
        throw new Error(
          'The selected session does not contain valid saved performance results.'
        )
      }

      if (controller.signal.aborted) {
        return
      }

      // Maps saved score information into the existing frontend structure.
      const scoreResult = {
        session_id: data.session_id,
        filename: data.score_filename,
        status: 'score_uploaded',
        summary: data.score_summary,
      }

      // Maps saved audio analysis into the existing frontend structure.
      const audioResult = {
        session_id: data.session_id,
        filename: data.audio_filename,
        status: data.status,
        detected_pitches: data.detected_pitches ?? [],
        note_events: data.note_events ?? [],
        performance_analysis: data.performance_analysis,
        performance_summary: data.performance_summary,
        note_feedback: data.note_feedback ?? [],
        problem_areas: data.problem_areas ?? [],
        score_annotations: data.score_annotations ?? null,
        ai_feedback: data.ai_feedback ?? null,
      }

      // Reuses the existing Performance Results page without reanalysis.
      navigate('/performance-results', {
        state: {
          sessionId: data.session_id,
          scoreResult,
          audioResult,

          // These values are not separately persisted by the backend.
          startMeasure: null,
          endMeasure: null,
          performanceAudioFile: null,

          // Identifies a previously completed practice session.
          isHistoricalSession: true,
          practiceDate: data.created_at,
        },
      })
    } catch (requestError) {
      if (controller.signal.aborted) {
        return
      }

      setSessionError(
        requestError instanceof TypeError
          ? 'Unable to connect to the backend. Please check your connection and try again.'
          : requestError.message ||
              'Unable to retrieve the selected practice session.'
      )
    } finally {
      if (sessionRequestRef.current === controller) {
        sessionRequestRef.current = null
      }

      if (!controller.signal.aborted) {
        setSelectedSessionId(null)
      }
    }
  }

  return (
    <div className="practice-history-page">
      <main className="practice-history-content">
        {/* Navigation */}
        <div className="practice-history-navigation">
          <button
            type="button"
            className="practice-history-back-button"
            onClick={() => navigate('/dashboard')}
          >
            <span aria-hidden="true">←</span>
            Back to Dashboard
          </button>
        </div>

        {/* Page heading */}
        <header className="practice-history-header">
          <span className="practice-history-eyebrow">
            YOUR PRACTICE SPACE
          </span>

          <h1>Practice History</h1>

          <p>
            Review your previous practice sessions and
            performance results.
          </p>
        </header>

        {/* Loading state */}
        {loading && (
          <div
            className="practice-history-loading"
            role="status"
          >
            <span
              className="practice-history-spinner"
              aria-hidden="true"
            />

            <p>Loading your practice history...</p>
          </div>
        )}

        {/* Practice history retrieval error */}
        {!loading && error && (
          <div
            className="practice-history-error"
            role="alert"
          >
            <h2>Unable to Load Practice History</h2>

            <p>{error}</p>

            <button
              type="button"
              className="practice-history-retry-button"
              onClick={() => {
                setRetryCount((previous) => previous + 1)
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty practice history */}
        {!loading && !error && sessions.length === 0 && (
          <div className="practice-history-empty">
            <div
              className="practice-history-empty-icon"
              aria-hidden="true"
            >
              ♫
            </div>

            <h2>No Practice Sessions Yet</h2>

            <p>
              You have not completed any practice sessions yet.
              Start a practice session to receive performance
              feedback and build your practice history.
            </p>

            <button
              type="button"
              className="practice-history-primary-button"
              onClick={() => navigate('/practice')}
            >
              Start Practice Session
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {/* Completed practice sessions */}
        {!loading && !error && sessions.length > 0 && (
          <section
            className="practice-history-section"
            aria-labelledby="practice-history-sessions-heading"
          >
            <div className="practice-history-section-heading">
              <div>
                <h2 id="practice-history-sessions-heading">
                  Completed Practice Sessions
                </h2>

                <p>
                  Select a session to review its detailed
                  performance results.
                </p>
              </div>

              <span className="practice-history-session-count">
                {sessions.length}{' '}
                {sessions.length === 1 ? 'session' : 'sessions'}
              </span>
            </div>

            {/* Individual session retrieval error */}
            {sessionError && (
              <div
                className="practice-history-error"
                role="alert"
              >
                <h2>Unable to Load Session</h2>

                <p>{sessionError}</p>

                <p>
                  Select View Results to try again.
                </p>
              </div>
            )}

            <div className="practice-history-grid">
              {sessions.map((session) => {
                const metrics =
                  session.performance_summary?.metrics

                const isSelected =
                  selectedSessionId === session.session_id

                return (
                  <article
                    className="practice-history-card"
                    key={session.session_id}
                  >
                    {/* Session information */}
                    <div className="practice-history-card-header">
                      <div
                        className="practice-history-card-icon"
                        aria-hidden="true"
                      >
                        ♫
                      </div>

                      <div className="practice-history-card-title">
                        <h3>
                          {session.score_filename ||
                            'Unknown Score'}
                        </h3>

                        <p>
                          {formatPracticeDate(
                            session.created_at
                          )}
                        </p>
                      </div>

                      <span className="practice-history-status">
                        Completed
                      </span>
                    </div>

                    {/* Saved performance recording filename */}
                    <div className="practice-history-audio-file">
                      <span>Performance Recording</span>

                      <p>
                        {session.audio_filename ||
                          'Filename unavailable'}
                      </p>
                    </div>

                    {/* Saved performance metrics */}
                    <div className="practice-history-metrics">
                      <div className="practice-history-metric">
                        <span>Pitch Accuracy</span>

                        <strong>
                          {formatPercentage(
                            metrics?.pitch_accuracy
                              ?.accuracy_percent
                          )}
                        </strong>
                      </div>

                      <div className="practice-history-metric">
                        <span>Rhythmic Accuracy</span>

                        <strong>
                          {formatPercentage(
                            metrics?.rhythmic_accuracy
                              ?.accuracy_percent
                          )}
                        </strong>
                      </div>

                      <div className="practice-history-metric">
                        <span>Tempo Consistency</span>

                        <strong>
                          {formatPercentage(
                            metrics?.tempo_consistency
                              ?.consistency_percent
                          )}
                        </strong>
                      </div>

                      <div className="practice-history-metric">
                        <span>Note Sequence Accuracy</span>

                        <strong>
                          {formatPercentage(
                            metrics?.note_sequence_accuracy
                              ?.accuracy_percent
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* Opens the saved performance results */}
                    <button
                      type="button"
                      className="practice-history-view-button"
                      disabled={selectedSessionId !== null}
                      onClick={() =>
                        handleViewResults(session.session_id)
                      }
                    >
                      {isSelected ? (
                        <>
                          <span
                            className="practice-history-spinner"
                            aria-hidden="true"
                          />

                          Loading Results...
                        </>
                      ) : (
                        <>
                          View Results
                          <span aria-hidden="true">→</span>
                        </>
                      )}
                    </button>

                    {isSelected && (
                      <p
                        className="practice-history-session-loading"
                        role="status"
                      >
                        Retrieving saved performance results...
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default PracticeHistory