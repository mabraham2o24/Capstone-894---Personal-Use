import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authFetch } from "../auth.js";
import AnnotatedSheetMusic from '../components/AnnotatedSheetMusic'

function PerformanceResults() {
  // Navigation and session information
  const navigate = useNavigate()
  const location = useLocation()

  const sessionId = location.state?.sessionId
  const scoreResult = location.state?.scoreResult
  const audioResult = location.state?.audioResult

  // Sprint 4 - Retrieve the uploaded score for this practice session.
  const [scoreState, setScoreState] = useState(null)

  const currentScore = scoreState?.sessionId === sessionId
    ? scoreState
    : null

  const musicXML = currentScore?.xml ?? ''
  const scoreLoading = Boolean(sessionId && audioResult && !currentScore)
  const scoreError = currentScore?.error ?? ''
  const scoreAnnotations = audioResult?.score_annotations ?? null
  const hasAudioResult = Boolean(audioResult)

  useEffect(() => {
    if (!sessionId || !hasAudioResult) return

    const controller = new AbortController()
    let cancelled = false

    setScoreState(null)

    const loadScore = async () => {
      try {
        const response = await authFetch(
          `/sessions/${encodeURIComponent(sessionId)}/score`,
          {
            signal: controller.signal,
          }
        )

        if (response.status === 404) {
          throw new Error(
            'The uploaded sheet music is unavailable for this session. Older practice sessions may not have a stored score.'
          )
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            'You are not authorized to retrieve this sheet music. Please sign in again.'
          )
        }

        if (!response.ok) {
          throw new Error(
            'Unable to retrieve the uploaded sheet music.'
          )
        }

        const xml = await response.text()

        if (!xml.trim()) {
          throw new Error(
            'The uploaded sheet music is empty.'
          )
        }

        if (!cancelled) {
          setScoreState({
            sessionId,
            xml,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setScoreState({
            sessionId,
            xml: '',
            error: error instanceof TypeError
              ? 'Unable to connect to the backend to retrieve sheet music.'
              : error.message || 'Unable to load sheet music.',
          })
        }
      }
    }

    loadScore()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [sessionId, hasAudioResult])

  const startMeasure = location.state?.startMeasure
  const endMeasure = location.state?.endMeasure

  // US-20 - Historical practice session information
  const isHistoricalSession =
    location.state?.isHistoricalSession === true

  const practiceDate = location.state?.practiceDate

  const performanceAudioFile = location.state?.performanceAudioFile;

  const [performanceAudioUrl, setPerformanceAudioUrl] = useState(null);
  const [referenceAudioUrl, setReferenceAudioUrl] = useState(null);
  const [referenceAudioLoading, setReferenceAudioLoading] = useState(false);
  const [referenceAudioError, setReferenceAudioError] = useState("");
  const [referenceAudioMetadata, setReferenceAudioMetadata] = useState(null);

  // US-19 - AI Practice Feedback state
  const [aiFeedback, setAiFeedback] = useState(
    audioResult?.ai_feedback ?? null
  )
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false)
  const [aiFeedbackError, setAiFeedbackError] = useState('')

  const performanceAudioRef = useRef(null);
  const referenceAudioRef = useRef(null);

  // US-20 - Load saved AI feedback when the selected session changes.
  useEffect(() => {
    setAiFeedback(audioResult?.ai_feedback ?? null)
    setAiFeedbackError('')
  }, [sessionId, audioResult])

  useEffect(() => {
    if (isHistoricalSession || !performanceAudioFile) {
      setPerformanceAudioUrl(null);
      return;
    }

    const url = URL.createObjectURL(performanceAudioFile);

    setPerformanceAudioUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [performanceAudioFile, isHistoricalSession]);

  useEffect(() => {
    // US-20 - Reference audio is unavailable for historical sessions.
    if (
      isHistoricalSession ||
      !sessionId ||
      startMeasure == null ||
      endMeasure == null
    ) {
      setReferenceAudioUrl(null);
      setReferenceAudioLoading(false);
      setReferenceAudioError("");
      setReferenceAudioMetadata(null);
      return;
    }

    const controller = new AbortController();

    let objectUrl = null;
    let cancelled = false;

    async function loadReferenceAudio() {
      setReferenceAudioLoading(true);
      setReferenceAudioError("");
      setReferenceAudioUrl(null);
      setReferenceAudioMetadata(null);

      try {
        const params = new URLSearchParams({
          start_measure: String(startMeasure),
          end_measure: String(endMeasure),
        });

        const response = await authFetch(
          `/sessions/${sessionId}/reference-audio?${params}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          throw new Error(
            typeof errorData.detail === "string"
              ? errorData.detail
              : "Unable to generate expected audio."
          );
        }

        const audioBlob = await response.blob();

        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(audioBlob);

        setReferenceAudioUrl(objectUrl);

        setReferenceAudioMetadata({
          tempoBpm: response.headers.get("X-Tempo-BPM"),
          tempoSource: response.headers.get("X-Tempo-Source"),
          duration: response.headers.get("X-Audio-Duration"),
        });
      } catch (error) {
        if (!cancelled && error.name !== "AbortError") {
          setReferenceAudioError(
            error.message || "Unable to load expected audio."
          );
        }
      } finally {
        if (!cancelled) {
          setReferenceAudioLoading(false);
        }
      }
    }

    loadReferenceAudio();

    return () => {
      cancelled = true;
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [sessionId, startMeasure, endMeasure, isHistoricalSession]);

  function handlePerformancePlay() {
    referenceAudioRef.current?.pause();
  }

  function handleReferencePlay() {
    performanceAudioRef.current?.pause();
  }

  function getReferenceTempoLabel(source) {
    switch (source) {
      case "score":
        return "Specified in the score";

      case "performance":
        return "Estimated from your performance";

      case "default":
        return "Default tempo";

      default:
        return "";
    }
  }

  // Note-level feedback
  const noteFeedback = audioResult?.note_feedback ?? []

  // Sprint 3 performance summary
  const performanceSummary = audioResult?.performance_summary
  const metrics = performanceSummary?.metrics

  // US-19 - Generate personalized AI practice feedback
  const handleGenerateAIFeedback = async () => {
    // US-20 - Historical sessions only display saved AI feedback.
    if (
      isHistoricalSession ||
      !sessionId ||
      !performanceSummary ||
      aiFeedbackLoading
    ) {
      return
    }

    setAiFeedbackLoading(true)
    setAiFeedbackError('')

    try {
      const response = await authFetch(
        `/sessions/${sessionId}/ai-feedback`,
        {
          method: 'POST',
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Unable to generate AI practice feedback. Please try again.'
        )
      }

      if (
        !data.ai_feedback ||
        typeof data.ai_feedback.overall_assessment !== 'string' ||
        !Array.isArray(data.ai_feedback.recommendations) ||
        typeof data.ai_feedback.next_session_goal !== 'string'
      ) {
        throw new Error(
          'No valid AI practice feedback was returned. Please try again.'
        )
      }

      setAiFeedback(data.ai_feedback)
    } catch (error) {
      setAiFeedbackError(
        error instanceof TypeError
          ? 'Unable to connect to the backend. Please check your connection and try again.'
          : error.message ||
            'Unable to generate AI practice feedback. Please try again.'
      )
    } finally {
      setAiFeedbackLoading(false)
    }
  }

  // US-14, US-15, US-16 - Performance accuracy metrics
  const pitchAccuracy = metrics?.pitch_accuracy
  const rhythmicAccuracy = metrics?.rhythmic_accuracy
  const tempoConsistency = metrics?.tempo_consistency
  const noteSequenceAccuracy = metrics?.note_sequence_accuracy

  // US-17 - Problem areas
  const problemAreas =
    performanceSummary?.problem_areas ??
    audioResult?.problem_areas ??
    []

  // US-18 - Detected error counts
  const errorCounts = performanceSummary?.error_counts

  // UAT-06 - Detect when the backend could not calculate metrics.
  // A valid accuracy of 0% must NOT count as missing data.
  const hasCalculatedMetrics = [
    pitchAccuracy?.accuracy_percent,
    rhythmicAccuracy?.accuracy_percent,
    tempoConsistency?.consistency_percent,
    noteSequenceAccuracy?.accuracy_percent,
  ].some(
    (value) =>
      value != null &&
      value !== '' &&
      Number.isFinite(Number(value))
  )

  const hasInsufficientAudioData = !hasCalculatedMetrics

  // Format note feedback statuses
  const formatStatus = (status) => {
    if (status == null || status === '') {
      return 'Not available'
    }

    return String(status).replace(/_/g, ' ')
  }

  // Apply existing status colors
  const getStatusClass = (status) => {
    if (status == null || status === '') {
      return 'feedback-status-neutral'
    }

    const normalizedStatus = String(status)
      .toLowerCase()
      .replace(/_/g, ' ')
      .trim()

    if (
      normalizedStatus === 'correct' ||
      normalizedStatus === 'on time'
    ) {
      return 'feedback-status-success'
    }

    if (
      normalizedStatus === 'incorrect' ||
      normalizedStatus === 'missing' ||
      normalizedStatus === 'additional'
    ) {
      return 'feedback-status-error'
    }

    if (
      normalizedStatus === 'early' ||
      normalizedStatus === 'late' ||
      normalizedStatus === 'too short' ||
      normalizedStatus === 'too long'
    ) {
      return 'feedback-status-warning'
    }

    return 'feedback-status-neutral'
  }

  // Display unavailable values
  const formatValue = (value) => {
    if (value == null || value === '') {
      return 'N/A'
    }

    return String(value)
  }

  // A note judged the correct length shows its expected length, since
  // the measured length can round to a neighboring note value (or
  // include a following rest) while still being within tolerance
  const formatPlayedLength = (feedback) => {
    if (feedback.duration_status === 'correct') {
      return formatValue(feedback.expected_note_length)
    }

    return formatValue(feedback.played_note_length)
  }

  // Backend metric percentages are already on a 0-100 scale
  const formatPercent = (value) => {
    if (
      value == null ||
      value === '' ||
      !Number.isFinite(Number(value))
    ) {
      return 'N/A'
    }

    return `${Number(value).toFixed(2)}%`
  }

  // Keep progress bar widths between 0% and 100%
  const getProgressWidth = (value) => {
    if (value == null || value === '') {
      return '0%'
    }

    const percentage = Number(value)

    if (!Number.isFinite(percentage)) {
      return '0%'
    }

    return `${Math.max(0, Math.min(100, percentage))}%`
  }

  // Make error type names easier to read
  const formatErrorType = (errorType) => {
    return String(errorType).replace(/_/g, ' ')
  }

  // Create CSS classes for color-coded error types
  const getErrorTypeClass = (errorType) => {
    return `error-type-${String(errorType)
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/\s+/g, '-')}`
  }

  // Determine whether a played note is missing
  const isMissingPlayedNote = (errorLocation) => {
    const errors = errorLocation.errors ?? []

    return errors.some(
      (error) => String(error).toLowerCase() === 'missing'
    )
  }

  // US-20 - Format the saved practice session date.
  const formatPracticeDate = (value) => {
    if (!value) {
      return 'Not available'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return 'Not available'
    }

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Format selected measure range for Session Overview
  const formatMeasureRange = () => {
    if (startMeasure == null && endMeasure == null) {
      return isHistoricalSession ? 'Not available' : 'N/A'
    }

    if (startMeasure == null) {
      return formatValue(endMeasure)
    }

    if (
      endMeasure == null ||
      String(startMeasure) === String(endMeasure)
    ) {
      return formatValue(startMeasure)
    }

    return `${startMeasure}–${endMeasure}`
  }

  // Prevent errors when opening the page without session data
  if (!sessionId || !audioResult) {
    return (
      <div className="performance-results-page">
        <div className="performance-card">
          <h1>Performance Results</h1>

          <p className="message">
            No processed performance is available.
          </p>

          <button
            className="back-button"
            onClick={() =>
              navigate(
                isHistoricalSession
                  ? '/practice-history'
                  : '/dashboard'
              )
            }
          >
            {isHistoricalSession
              ? '← Back to Practice History'
              : '← Back to Dashboard'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="performance-results-page">
      <div className="performance-card">

        {/* US-20 - Navigation depends on the session type */}
        <button
          className="back-button"
          onClick={() => {
            if (isHistoricalSession) {
              navigate('/practice-history')
            } else {
              navigate('/performance-upload', {
                state: {
                  sessionId: sessionId,
                  scoreResult: scoreResult,
                  startMeasure: startMeasure,
                  endMeasure: endMeasure,
                },
              })
            }
          }}
        >
          {isHistoricalSession
            ? '← Back to Practice History'
            : '← Back to Performance Upload'}
        </button>

        {/* PERFORMANCE RESULTS HEADING */}
        <div className="performance-results-header">
          <h1>
            {isHistoricalSession
              ? 'Historical Performance Results'
              : 'Performance Results'}
          </h1>

          {hasInsufficientAudioData ? (
            <p
              className="performance-insufficient-heading"
              role="status"
              style={{
                color: '#fbbf24',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              ⚠ Insufficient Audio Data
            </p>
          ) : (
            <p className="success-text">
              {isHistoricalSession
                ? '✓ Saved performance results retrieved successfully.'
                : '✓ Audio successfully processed.'}
            </p>
          )}
        </div>

        {/* UAT-06 - Insufficient audio explanation */}
        {hasInsufficientAudioData && (
          <div
            className="performance-insufficient-warning"
            role="alert"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.09)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '24px',
              color: '#f8fafc',
            }}
          >
            <h2
              style={{
                color: '#fbbf24',
                marginTop: 0,
                marginBottom: '10px',
                fontSize: '1.15rem',
              }}
            >
              Insufficient Audio Data
            </h2>

            <p style={{ margin: 0, lineHeight: 1.7 }}>
              {isHistoricalSession
                ? 'The saved recording did not contain enough audio data to calculate performance metrics.'
                : 'The uploaded recording does not contain enough audio data to calculate performance metrics. Please upload a longer recording and try again.'}
            </p>

            <p
              style={{
                color: '#cbd5e1',
                marginBottom: 0,
                fontSize: '0.9rem',
              }}
            >
              Your session information and any detected pitches
              are still available below.
            </p>
          </div>
        )}

        {/* SESSION OVERVIEW */}
        <div className="performance-session-overview">
          <div className="performance-session-heading">
            <h2>Session Overview</h2>

            <span
              className="performance-analysis-badge"
              style={
                hasInsufficientAudioData
                  ? {
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      borderColor: 'rgba(245, 158, 11, 0.5)',
                      color: '#fbbf24',
                    }
                  : undefined
              }
            >
              {hasInsufficientAudioData
                ? 'Insufficient Data'
                : 'Analysis Complete'}
            </span>
          </div>

          {/* First row - recording information */}
          <div className="performance-session-info-grid">
            <div className="performance-session-info-card">
              <span>Audio File</span>
              <strong>
                {formatValue(audioResult.filename)}
              </strong>
            </div>

            <div className="performance-session-info-card">
              <span>Session ID</span>
              <strong>
                {formatValue(sessionId)}
              </strong>
            </div>
          </div>

          {/* US-20 - Saved practice session date */}
          {isHistoricalSession && (
            <div className="performance-session-info-grid">
              <div className="performance-session-info-card">
                <span>Practice Date</span>
                <strong>
                  {formatPracticeDate(practiceDate)}
                </strong>
              </div>
            </div>
          )}

          {/* Second row - session statistics */}
          <div className="performance-session-stats-grid">
            <div className="performance-session-stat-card">
              <span className="performance-session-stat-icon">
                ♫
              </span>
              <span>Selected Measures</span>
              <strong>{formatMeasureRange()}</strong>
            </div>

            <div className="performance-session-stat-card">
              <span className="performance-session-stat-icon">
                ♪
              </span>
              <span>Detected Pitches</span>
              <strong>
                {audioResult.detected_pitches?.length ?? 0}
              </strong>
            </div>

            <div className="performance-session-stat-card">
              <span className="performance-session-stat-icon">
                ≡
              </span>
              <span>Note Events</span>
              <strong>
                {audioResult.note_events?.length ?? 0}
              </strong>
            </div>
          </div>
        </div>

        {/* SPRINT 4 - ANNOTATED SHEET MUSIC */}
        {/* Display the actual uploaded score and backend annotations. */}
        <AnnotatedSheetMusic
          key={sessionId}
          musicXML={musicXML}
          scoreAnnotations={scoreAnnotations}
          scoreLoading={scoreLoading}
          scoreError={scoreError}
        />

        {/* THREE-COLUMN PERFORMANCE RESULTS LAYOUT */}
        <div className="performance-results-layout">

          {/* LEFT COLUMN - PERFORMANCE SUMMARY */}
          <div className="performance-results-column">
            <h2>Performance Summary</h2>

            <p className="subtitle">
              Review your performance accuracy across
              the four calculated metrics.
            </p>

            {!performanceSummary ? (
              <p className="message">
                {hasInsufficientAudioData
                  ? 'Performance metrics could not be calculated from this recording.'
                  : 'No performance summary was returned for this recording.'}
              </p>
            ) : (
              <div className="summary-grid">

                {/* US-14 - Pitch Accuracy */}
                <div>
                  <span>Pitch Accuracy</span>
                  <strong>
                    {formatPercent(pitchAccuracy?.accuracy_percent)}
                  </strong>

                  <div className="performance-progress-track">
                    <div
                      className="performance-progress-fill pitch-progress"
                      style={{
                        width: getProgressWidth(
                          pitchAccuracy?.accuracy_percent
                        ),
                      }}
                    />
                  </div>

                  <p>
                    {formatValue(pitchAccuracy?.correct_notes)} of{' '}
                    {formatValue(pitchAccuracy?.total_expected_notes)}{' '}
                    notes correct
                  </p>
                </div>

                {/* US-15 - Rhythmic Accuracy */}
                <div>
                  <span>Rhythmic Accuracy</span>
                  <strong>
                    {formatPercent(rhythmicAccuracy?.accuracy_percent)}
                  </strong>

                  <div className="performance-progress-track">
                    <div
                      className="performance-progress-fill rhythm-progress"
                      style={{
                        width: getProgressWidth(
                          rhythmicAccuracy?.accuracy_percent
                        ),
                      }}
                    />
                  </div>

                  <p>
                    Onset Accuracy:{' '}
                    {formatPercent(
                      rhythmicAccuracy?.onset_accuracy_percent
                    )}
                  </p>

                  <p>
                    Duration Accuracy:{' '}
                    {formatPercent(
                      rhythmicAccuracy?.duration_accuracy_percent
                    )}
                  </p>
                </div>

                {/* US-16 - Tempo Consistency */}
                <div>
                  <span>Tempo Consistency</span>
                  <strong>
                    {formatPercent(
                      tempoConsistency?.consistency_percent
                    )}
                  </strong>

                  <div className="performance-progress-track">
                    <div
                      className="performance-progress-fill tempo-progress"
                      style={{
                        width: getProgressWidth(
                          tempoConsistency?.consistency_percent
                        ),
                      }}
                    />
                  </div>

                  <p>
                    Tempo Variation:{' '}
                    {formatPercent(
                      tempoConsistency?.variation_percent
                    )}
                  </p>
                </div>

                {/* Note Sequence Accuracy */}
                <div>
                  <span>Note Sequence Accuracy</span>
                  <strong>
                    {formatPercent(
                      noteSequenceAccuracy?.accuracy_percent
                    )}
                  </strong>

                  <div className="performance-progress-track">
                    <div
                      className="performance-progress-fill sequence-progress"
                      style={{
                        width: getProgressWidth(
                          noteSequenceAccuracy?.accuracy_percent
                        ),
                      }}
                    />
                  </div>

                  <p>
                    {formatValue(noteSequenceAccuracy?.correct_notes)} of{' '}
                    {formatValue(
                      noteSequenceAccuracy?.total_expected_notes
                    )}{' '}
                    notes correct
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* MIDDLE COLUMN - PERFORMANCE FEEDBACK */}
          <div className="performance-results-column">
            <h2>Performance Feedback</h2>

            <p className="subtitle">
              {isHistoricalSession
                ? 'Review the saved pitch, timing, and note duration feedback for this practice session.'
                : 'Review the pitch, timing, and note duration feedback for your selected measures.'}
            </p>

            {noteFeedback.length === 0 ? (
              <p className="message">
                {hasInsufficientAudioData
                  ? 'Note-level feedback is unavailable because there was not enough audio data for analysis.'
                  : 'No note-level feedback was returned for this performance.'}
              </p>
            ) : (
              <div className="table-container">
                <table className="notes-table">
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th>Beat</th>
                      <th>Expected Note</th>
                      <th>Played Note</th>
                      <th>Pitch Status</th>
                      <th>Expected Length</th>
                      <th>Played Length</th>
                      <th>Duration Status</th>
                      <th>Timing Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {noteFeedback.map((feedback, index) => (
                      <tr key={index}>
                        <td>{formatValue(feedback.measure)}</td>
                        <td>{formatValue(feedback.beat)}</td>
                        <td>{formatValue(feedback.expected_note)}</td>
                        <td>{formatValue(feedback.played_note)}</td>

                        <td>
                          <span
                            className={`feedback-status ${getStatusClass(
                              feedback.pitch_status
                            )}`}
                          >
                            {formatStatus(feedback.pitch_status)}
                          </span>
                        </td>

                        <td>
                          {formatValue(feedback.expected_note_length)}
                        </td>

                        <td>
                          {formatPlayedLength(feedback)}
                        </td>

                        <td>
                          <span
                            className={`feedback-status ${getStatusClass(
                              feedback.duration_status
                            )}`}
                          >
                            {formatStatus(feedback.duration_status)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`feedback-status ${getStatusClass(
                              feedback.timing_status
                            )}`}
                          >
                            {formatStatus(feedback.timing_status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - REVIEW TOOLS */}
          <div className="performance-results-column performance-options-column">
            <h2>Audio Review</h2>

            <h3 className="performance-options-label">
              {isHistoricalSession
                ? 'Historical Audio Playback'
                : 'Playback Controls'}
            </h3>

            <div className="performance-display-options">
              <div className="performance-audio-card">
                <h4>Your Performance</h4>

                <p className="performance-audio-description">
                  {isHistoricalSession
                    ? 'Historical performance recording'
                    : `Measures ${startMeasure}–${endMeasure} · Recorded audio`}
                </p>

                {isHistoricalSession ? (
                  <p className="performance-audio-message">
                    Original audio playback is not available
                    for historical practice sessions.
                  </p>
                ) : performanceAudioUrl ? (
                  <audio
                    ref={performanceAudioRef}
                    src={performanceAudioUrl}
                    controls
                    preload="metadata"
                    onPlay={handlePerformancePlay}
                    aria-label="Your performance audio"
                  />
                ) : (
                  <p className="performance-audio-message">
                    Original performance audio is unavailable.
                  </p>
                )}
              </div>

              <div className="performance-audio-card">
                <h4>Expected Audio</h4>

                <p className="performance-audio-description">
                  {isHistoricalSession
                    ? 'Historical reference audio'
                    : `Measures ${startMeasure}–${endMeasure} · Computer-generated audio`}
                </p>

                {isHistoricalSession ? (
                  <p className="performance-audio-message">
                    Expected audio playback is not available
                    for historical practice sessions.
                  </p>
                ) : referenceAudioLoading ? (
                  <p
                    className="performance-audio-message"
                    role="status"
                  >
                    Generating expected audio...
                  </p>
                ) : referenceAudioError ? (
                  <p
                    className="performance-audio-error"
                    role="alert"
                  >
                    {referenceAudioError}
                  </p>
                ) : referenceAudioUrl ? (
                  <>
                    <audio
                      ref={referenceAudioRef}
                      src={referenceAudioUrl}
                      controls
                      preload="metadata"
                      onPlay={handleReferencePlay}
                      aria-label="Expected reference audio"
                    />

                    {referenceAudioMetadata?.tempoBpm && (
                      <p className="performance-audio-tempo">
                        Tempo: {referenceAudioMetadata.tempoBpm} BPM
                        {" · "}
                        {getReferenceTempoLabel(
                          referenceAudioMetadata.tempoSource
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="performance-audio-message">
                    Expected audio is unavailable.
                  </p>
                )}
              </div>
            </div>

            {/* Color key for errors */}
            <div className="performance-legend">
              <h3>Legend</h3>

              <div className="performance-legend-items">
                <div className="performance-legend-item">
                  <span className="legend-color legend-timing"></span>
                  <span>Timing Error</span>
                </div>

                <div className="performance-legend-item">
                  <span className="legend-color legend-duration"></span>
                  <span>Duration Error</span>
                </div>

                <div className="performance-legend-item">
                  <span className="legend-color legend-missing"></span>
                  <span>Missing Note</span>
                </div>

                <div className="performance-legend-item">
                  <span className="legend-color legend-incorrect"></span>
                  <span>Incorrect Pitch</span>
                </div>

                <div className="performance-legend-item">
                  <span className="legend-color legend-additional"></span>
                  <span>Additional Note</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PERFORMANCE ERRORS & PROBLEM AREAS */}
        <div className="performance-section performance-errors-section">
          <h2>Performance Errors &amp; Problem Areas</h2>

          <p className="subtitle">
            Review detected errors and measures that may
            require additional practice.
          </p>

          {/* US-18 - Detected Error Counts */}
          <h3 className="performance-errors-heading">
            Detected Error Counts
          </h3>

          <div className="summary-grid performance-error-count-grid">
            <div>
              <span>Incorrect Pitches</span>
              <strong>
                {formatValue(errorCounts?.incorrect_pitch)}
              </strong>
            </div>

            <div>
              <span>Missing Notes</span>
              <strong>
                {formatValue(errorCounts?.missing_notes)}
              </strong>
            </div>

            <div>
              <span>Additional Notes</span>
              <strong>
                {formatValue(errorCounts?.additional_notes)}
              </strong>
            </div>
          </div>

          {/* US-17 - Problem Area Overview */}
          <div className="performance-problem-overview">
            <h3>Problem Areas</h3>

            <p className="subtitle">
              Measures identified by the backend as having
              multiple errors or a high error rate.
            </p>

            {problemAreas.length === 0 ? (
              <p
                className={
                  hasInsufficientAudioData
                    ? 'performance-empty-neutral'
                    : 'performance-empty-success'
                }
              >
                {hasInsufficientAudioData
                  ? 'Problem areas could not be determined because there was not enough audio data for analysis.'
                  : '✓ No problem areas were identified for this performance.'}
              </p>
            ) : (
              <div className="performance-problem-list">
                {problemAreas.map((area, index) => (
                  <div
                    className="performance-problem-card"
                    key={`${area.measure}-${index}`}
                  >
                    <div className="performance-problem-header">
                      <h3>
                        Measure {formatValue(area.measure)}
                      </h3>

                      <span
                        className={`performance-practice-badge ${
                          area.requires_practice
                            ? 'practice-required'
                            : 'practice-not-required'
                        }`}
                      >
                        {area.requires_practice
                          ? 'Requires Practice'
                          : 'No Practice Required'}
                      </span>
                    </div>

                    <div className="summary-grid performance-problem-stats">
                      <div>
                        <span>Total Notes</span>
                        <strong>
                          {formatValue(area.total_notes)}
                        </strong>
                      </div>

                      <div>
                        <span>Notes With Errors</span>
                        <strong>
                          {formatValue(area.error_notes)}
                        </strong>
                      </div>

                      <div>
                        <span>Error Rate</span>
                        <strong>
                          {area.error_rate == null
                            ? 'N/A'
                            : formatPercent(area.error_rate * 100)}
                        </strong>
                      </div>
                    </div>

                    <h4>Error Types</h4>

                    {Object.keys(area.error_types ?? {}).length === 0 ? (
                      <p className="message">
                        No error types were provided.
                      </p>
                    ) : (
                      <div className="performance-error-types">
                        {Object.entries(area.error_types).map(
                          ([errorType, count]) => (
                            <span
                              className={`performance-error-type ${getErrorTypeClass(
                                errorType
                              )}`}
                              key={errorType}
                            >
                              {formatErrorType(errorType)}: {count}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ERROR LOCATIONS */}
        <div className="performance-section performance-error-locations-section">
          <h2>Error Locations</h2>

          <p className="subtitle">
            Review the exact beats and notes where errors
            were identified in problem measures.
          </p>

          {problemAreas.length === 0 ? (
            <p
              className={
                hasInsufficientAudioData
                  ? 'performance-empty-neutral'
                  : 'performance-empty-success'
              }
            >
              {hasInsufficientAudioData
                ? 'Error locations could not be determined because there was not enough audio data for analysis.'
                : '✓ No problem-area error locations were identified.'}
            </p>
          ) : (
            <div className="error-locations-list">
              {problemAreas.map((area, index) => (
                <div
                  className="error-location-measure-card"
                  key={`locations-${area.measure}-${index}`}
                >
                  <div className="error-location-measure-header">
                    <h3>
                      Measure {formatValue(area.measure)}
                    </h3>

                    <span
                      className={`performance-practice-badge ${
                        area.requires_practice
                          ? 'practice-required'
                          : 'practice-not-required'
                      }`}
                    >
                      {area.requires_practice
                        ? 'Requires Practice'
                        : 'No Practice Required'}
                    </span>
                  </div>

                  {!area.error_locations?.length ? (
                    <p className="message">
                      No specific error locations were provided.
                    </p>
                  ) : (
                    <div className="table-container error-location-table-container">
                      <table className="notes-table error-location-table">
                        <thead>
                          <tr>
                            <th>Beat</th>
                            <th>Expected Note</th>
                            <th>Played Note</th>
                            <th>Detected Errors</th>
                          </tr>
                        </thead>

                        <tbody>
                          {area.error_locations.map(
                            (errorLocation, errorIndex) => (
                              <tr key={errorIndex}>
                                <td>
                                  <span className="error-location-beat">
                                    {formatValue(errorLocation.beat)}
                                  </span>
                                </td>

                                <td>
                                  <span className="error-location-note">
                                    {formatValue(
                                      errorLocation.expected_note
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={`error-location-note ${
                                      isMissingPlayedNote(errorLocation)
                                        ? 'error-location-missing-note'
                                        : ''
                                    }`}
                                  >
                                    {formatValue(
                                      errorLocation.played_note
                                    )}
                                  </span>
                                </td>

                                <td>
                                  {errorLocation.errors?.length ? (
                                    <div className="error-location-error-tags">
                                      {errorLocation.errors.map(
                                        (errorType, typeIndex) => (
                                          <span
                                            className={`performance-error-type error-location-error-tag ${getErrorTypeClass(
                                              errorType
                                            )}`}
                                            key={`${errorType}-${typeIndex}`}
                                          >
                                            {formatErrorType(errorType)}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <span className="error-location-no-errors">
                                      N/A
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* US-19 - AI PRACTICE FEEDBACK */}
        <section
          className="performance-section ai-feedback-section"
          aria-labelledby="ai-feedback-heading"
        >
          <h2 id="ai-feedback-heading">
            AI Practice Feedback
          </h2>

          <p className="subtitle">
            {isHistoricalSession
              ? 'Review previously generated personalized practice recommendations for this session.'
              : 'Receive personalized practice recommendations based on your performance analysis.'}
          </p>

          {/* US-19 - Generate feedback for new practice sessions only */}
          {!isHistoricalSession && (
            <div className="ai-feedback-actions">
              <button
                type="button"
                className="upload-button ai-feedback-button"
                onClick={handleGenerateAIFeedback}
                disabled={aiFeedbackLoading || !performanceSummary}
              >
                {aiFeedbackLoading
                  ? 'Generating AI Practice Feedback...'
                  : 'Generate AI Practice Feedback'}
              </button>
            </div>
          )}

          {/* US-20 - Historical sessions without saved AI feedback */}
          {isHistoricalSession && !aiFeedback && (
            <p className="ai-feedback-message">
              No previously generated AI practice feedback
              is available for this practice session.
            </p>
          )}

          {/* US-19 - Performance analysis is required */}
          {!isHistoricalSession && !performanceSummary && !aiFeedback && (
            <p className="ai-feedback-message">
              Complete a performance analysis before
              requesting AI feedback.
            </p>
          )}

          {!isHistoricalSession && aiFeedbackLoading && (
            <p
              className="ai-feedback-loading"
              role="status"
            >
              Generating personalized feedback.
              This may take a moment.
            </p>
          )}

          {!isHistoricalSession && aiFeedbackError && (
            <p
              className="ai-feedback-error"
              role="alert"
            >
              {aiFeedbackError}
            </p>
          )}

          {aiFeedback && (
            <div className="ai-feedback-content">

              {/* Overall performance assessment */}
              <div className="ai-feedback-assessment">
                <h3>Overall Assessment</h3>

                <p>
                  {aiFeedback.overall_assessment}
                </p>
              </div>

              {/* Personalized practice exercises */}
              {aiFeedback.recommendations?.length > 0 && (
                <div className="ai-feedback-recommendations">
                  <h3>Recommended Practice Exercises</h3>

                  <div className="ai-feedback-exercise-grid">
                    {aiFeedback.recommendations
                      .slice(0, 3)
                      .map((recommendation, index) => (
                        <article
                          className="ai-feedback-exercise-card"
                          key={index}
                        >
                          <h4>Exercise {index + 1}</h4>

                          <div className="ai-feedback-exercise-details">
                            {recommendation.measure != null && (
                              <span className="ai-feedback-measure">
                                Measure {recommendation.measure}
                              </span>
                            )}

                            {recommendation.error_type && (
                              <span className="ai-feedback-error-type">
                                {formatErrorType(
                                  recommendation.error_type
                                )}
                              </span>
                            )}
                          </div>

                          <p>
                            {recommendation.exercise}
                          </p>
                        </article>
                      ))}
                  </div>
                </div>
              )}

              {/* Next-session practice goal */}
              <div className="ai-feedback-goal">
                <h3>Next-Session Practice Goal</h3>

                <p>
                  {aiFeedback.next_session_goal}
                </p>
              </div>

            </div>
          )}
        </section>

        {/* DETECTED PITCHES */}
        <div className="performance-section performance-detected-pitches-section">
          <h2>Detected Pitches</h2>

          <p className="subtitle">
            Notes identified from your recorded performance,
            displayed in detection order.
          </p>

          <div className="performance-pitch-container">
            <div className="performance-pitch-header">
              <h3>Pitch Sequence</h3>

              <span className="performance-pitch-count">
                {audioResult.detected_pitches?.length ?? 0} Detected
              </span>
            </div>

            {audioResult.detected_pitches?.length ? (
              <div className="performance-pitch-list">
                {audioResult.detected_pitches.map((pitch, index) => (
                  <span
                    className="performance-pitch-badge"
                    key={`${pitch}-${index}`}
                  >
                    {pitch}
                  </span>
                ))}
              </div>
            ) : (
              <p className="message">
                No pitches detected.
              </p>
            )}
          </div>
        </div>

        {/* US-20 - Return to the appropriate page */}
        <div className="page-actions">
          <button
            className="upload-button"
            onClick={() =>
              navigate(
                isHistoricalSession
                  ? '/practice-history'
                  : '/dashboard'
              )
            }
          >
            {isHistoricalSession
              ? 'Back to Practice History'
              : 'Back to Dashboard'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default PerformanceResults