import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { encodeWav } from '../utils/audioRecording.js'

import { authFetch } from '../auth.js'

function PerformanceUpload() {
  // Allows navigation between application pages.
  const navigate = useNavigate()

  // Gets the current practice session information
  // passed from the Score Processing page.
  const location = useLocation()

  const sessionId = location.state?.sessionId
  const scoreResult = location.state?.scoreResult

  // Gets the selected measure range from the Score Processing page.
  const startMeasure = location.state?.startMeasure
  const endMeasure = location.state?.endMeasure

  // Audio performance state.
  const [audioFile, setAudioFile] = useState(null)
  const [audioMessage, setAudioMessage] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)

  // US-06: Microphone recording state.
  const [isRecording, setIsRecording] = useState(false)
  const [recordingLoading, setRecordingLoading] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState(null)

  // US-06: Custom recording audio player state.
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackError, setPlaybackError] = useState('')

  // Reference to the custom audio player.
  const recordingAudioRef = useRef(null)

  // References to active browser audio resources.
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)
  const sourceRef = useRef(null)
  const processorRef = useRef(null)
  const samplesRef = useRef([])
  const recordingUrlRef = useRef(null)
  const recordingActiveRef = useRef(false)

  // Release microphone and audio resources.
  const cleanupRecording = () => {
    recordingActiveRef.current = false

    if (processorRef.current) {
      processorRef.current.port.onmessage = null
      processorRef.current.port.postMessage({ type: 'stop' })
      processorRef.current.port.close()
      processorRef.current.disconnect()
    }

    sourceRef.current?.disconnect()

    streamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })

    if (audioContextRef.current) {
      void audioContextRef.current.close()
    }

    processorRef.current = null
    sourceRef.current = null
    streamRef.current = null
    audioContextRef.current = null
  }

  // Release microphone resources when leaving the page.
  useEffect(() => {
    return () => {
      recordingActiveRef.current = false

      // Stop the AudioWorklet and close its message port.
      if (processorRef.current) {
        processorRef.current.port.onmessage = null
        processorRef.current.port.postMessage({ type: 'stop' })
        processorRef.current.port.close()
        processorRef.current.disconnect()
      }

      // Disconnect the microphone audio source.
      sourceRef.current?.disconnect()

      // Release microphone access.
      streamRef.current?.getTracks().forEach((track) => {
        track.stop()
      })

      // Close the audio context.
      if (audioContextRef.current) {
        void audioContextRef.current.close()
      }

      // Release the recording preview URL.
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current)
      }
    }
  }, [])

  // US-06: Apply the selected volume and mute settings
  // whenever a new recording is loaded.
  useEffect(() => {
    const audio = recordingAudioRef.current

    if (audio) {
      audio.volume = volume
      audio.muted = isMuted
    }
  }, [recordingUrl, volume, isMuted])

  // Reset the custom audio player for a new recording
  // or when the current recording is discarded.
  const resetRecordingPlayer = () => {
    const audio = recordingAudioRef.current

    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setPlaybackError('')
  }

  // Convert playback time into minutes and seconds.
  const formatAudioTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00'
    }

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
  }

  // Play or pause the recorded performance.
  const handlePlaybackToggle = async () => {
    const audio = recordingAudioRef.current

    if (!audio) return

    setPlaybackError('')

    try {
      if (audio.paused) {
        if (audio.ended) {
          audio.currentTime = 0
        }

        await audio.play()
      } else {
        audio.pause()
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setIsPlaying(false)
        setPlaybackError(
          'Unable to play the recording. Please try again.'
        )
      }
    }
  }

  // Update the playback position as the audio plays.
  const handlePlaybackTimeUpdate = () => {
    const audio = recordingAudioRef.current

    if (audio) {
      setCurrentTime(audio.currentTime)
    }
  }

  // Retrieve the recording duration.
  const handleAudioMetadata = () => {
    const audio = recordingAudioRef.current

    if (audio) {
      setDuration(
        Number.isFinite(audio.duration)
          ? audio.duration
          : 0
      )
    }
  }

  // Allow the user to seek to a different playback position.
  const handlePlaybackSeek = (event) => {
    const audio = recordingAudioRef.current
    const newTime = Number(event.target.value)

    if (
      !audio ||
      !Number.isFinite(newTime) ||
      duration <= 0
    ) {
      return
    }

    const safeTime = Math.min(
      Math.max(newTime, 0),
      duration
    )

    audio.currentTime = safeTime
    setCurrentTime(safeTime)
  }

  // Adjust recording playback volume.
  const handleVolumeChange = (event) => {
    const newVolume = Number(event.target.value)

    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  // Mute or unmute recording playback.
  const handleMuteToggle = () => {
    if (isMuted || volume === 0) {
      if (volume === 0) {
        setVolume(1)
      }

      setIsMuted(false)
    } else {
      setIsMuted(true)
    }
  }

  // Update playback state when the recording finishes.
  const handlePlaybackEnded = () => {
    setIsPlaying(false)

    const audio = recordingAudioRef.current

    if (audio) {
      setCurrentTime(audio.currentTime)
    }
  }

  // Calculate the filled portion of the playback progress bar.
  const playbackProgress =
    duration > 0
      ? Math.min(
          Math.max((currentTime / duration) * 100, 0),
          100
        )
      : 0

  // Calculate the filled portion of the volume slider.
  const volumeProgress = isMuted ? 0 : volume * 100

  // Request microphone access and begin capturing samples.
  const handleStartRecording = async () => {
    if (recordingActiveRef.current || recordingLoading || audioLoading) {
      return
    }

    setRecordingLoading(true)
    setAudioMessage('')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      streamRef.current = stream

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext

      if (!AudioContextClass) {
        throw new Error('Audio recording is not supported in this browser.')
      }

      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext

      await audioContext.resume()

      // Load the AudioWorklet processor.
      await audioContext.audioWorklet.addModule(
        '/audio-recorder-worklet.js'
      )

      const source = audioContext.createMediaStreamSource(stream)

      const processor = new AudioWorkletNode(
        audioContext,
        'audio-recorder-processor',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        }
      )

      sourceRef.current = source
      processorRef.current = processor
      samplesRef.current = []

      // Receive audio samples from the AudioWorklet.
      processor.port.onmessage = (event) => {
        if (event.data?.type !== 'audio') return

        samplesRef.current.push(event.data.samples)
      }

      // Reset playback before starting another recording.
      resetRecordingPlayer()

      // Connect the microphone to the processor.
      // The processor produces silence at its output.
      recordingActiveRef.current = true

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
      setAudioFile(null)

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current)
        recordingUrlRef.current = null
        setRecordingUrl(null)
      }
    } catch (error) {
      cleanupRecording()

      setAudioMessage(
        error.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access.'
          : error.message || 'Could not start recording.'
      )
    } finally {
      setRecordingLoading(false)
    }
  }

  // Stop recording and wait for the final AudioWorklet message.
  const handleStopRecording = async () => {
    if (!recordingActiveRef.current) return

    recordingActiveRef.current = false
    setIsRecording(false)
    setRecordingLoading(true)

    const processor = processorRef.current
    const sampleRate = audioContextRef.current?.sampleRate

    try {
      if (!processor) {
        throw new Error('Audio recorder is unavailable.')
      }

      // Wait until the AudioWorklet confirms it has stopped.
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio recorder did not stop correctly.'))
        }, 3000)

        processor.port.onmessage = (event) => {
          if (event.data?.type === 'audio') {
            samplesRef.current.push(event.data.samples)
          }

          if (event.data?.type === 'stopped') {
            clearTimeout(timeout)
            resolve()
          }
        }

        processor.port.postMessage({ type: 'stop' })
      })

      const chunks = samplesRef.current
      const totalSamples = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
      )

      if (totalSamples === 0) {
        throw new Error('No audio was captured. Please record again.')
      }

      const samples = new Float32Array(totalSamples)
      let offset = 0

      chunks.forEach((chunk) => {
        samples.set(chunk, offset)
        offset += chunk.length
      })

      const wavBlob = encodeWav(samples, sampleRate)

      const file = new File(
        [wavBlob],
        'recorded_performance.wav',
        { type: 'audio/wav' }
      )

      const url = URL.createObjectURL(file)

      // Reset the playback controls for the new recording.
      resetRecordingPlayer()

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current)
      }

      recordingUrlRef.current = url
      setRecordingUrl(url)
      setAudioFile(file)
      setAudioMessage('Recording ready. You can preview or upload it.')
    } catch (error) {
      setAudioFile(null)
      setAudioMessage(error.message || 'Could not process recording.')
    } finally {
      cleanupRecording()
      samplesRef.current = []
      setRecordingLoading(false)
    }
  }

  // Discard the captured recording.
  const handleDiscardRecording = () => {
    // Stop playback and reset the custom audio player.
    resetRecordingPlayer()

    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current)
      recordingUrlRef.current = null
    }

    setRecordingUrl(null)
    setAudioFile(null)
    samplesRef.current = []
    setAudioMessage('Recording discarded.')
  }

  // Handles selection of an existing WAV performance.
  const handleAudioFileChange = (event) => {
    const file = event.target.files[0]

    if (file) {
      setAudioFile(file)
      setAudioMessage('')
    }
  }

  // Uploads the WAV performance to the current practice session.
  const handleAudioUpload = async () => {
    if (!audioFile) {
      setAudioMessage('Please choose a WAV audio file first.')
      return
    }

    if (!sessionId) {
      setAudioMessage('No active practice session was found.')
      return
    }

    if (
      !Number.isInteger(startMeasure) ||
      !Number.isInteger(endMeasure) ||
      startMeasure < 1 ||
      endMeasure < startMeasure
    ) {
      setAudioMessage('Please select a valid measure range first.')
      return
    }

    setAudioLoading(true)
    setAudioMessage('')

    try {
      // Prepare the audio file and selected measures
      // for the FastAPI endpoint.
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('start_measure', String(startMeasure))
      formData.append('end_measure', String(endMeasure))

      // Send the WAV file and measure range to the
      // existing audio-analysis endpoint.
      const audioResponse = await authFetch(
        `/sessions/${sessionId}/upload-audio`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const audioData = await audioResponse.json()

      if (!audioResponse.ok) {
        throw new Error(
          audioData.detail || 'Audio upload failed.'
        )
      }

      // After successful analysis, go to the
      // Performance Results page.
      navigate("/performance-results", {
        state: {
          sessionId,
          scoreResult,
          audioResult: audioData,
          startMeasure,
          endMeasure,
          performanceAudioFile: audioFile,
        },
      });
    } catch (error) {
      setAudioMessage(error.message)
    } finally {
      setAudioLoading(false)
    }
  }

  // Prevents this page from being used without a practice
  // session and a valid selected measure range.
  if (
    !sessionId ||
    !scoreResult ||
    !Number.isInteger(startMeasure) ||
    !Number.isInteger(endMeasure)
  ) {
    return (
      <div className="performance-upload-page">
        <div className="performance-card">
          <h1>Add Your Performance</h1>

          <p className="message">
            No active practice session or measure selection is available.
          </p>

          <button
            className="back-button"
            onClick={() => navigate('/practice')}
          >
            ← Start a Practice Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="performance-upload-page">
      <div className="performance-card">
        <button
          className="back-button"
          onClick={() =>
            navigate('/score-processing', {
              state: {
                sessionId: sessionId,
                scoreResult: scoreResult,
                startMeasure: startMeasure,
                endMeasure: endMeasure,
              },
            })
          }
        >
          ← Back to Score
        </button>

        <h1>Add Your Performance</h1>

        <p className="subtitle">
          Record your performance using your microphone or
          upload an existing WAV recording.
        </p>

        {/* Shows which practice session, score, and
            measure range this performance belongs to. */}
        <div className="summary-grid">
          <div>
            <span>Session ID</span>
            <strong>{sessionId}</strong>
          </div>

          <div>
            <span>MusicXML File</span>
            <strong>{scoreResult.filename}</strong>
          </div>

          <div>
            <span>Starting Measure</span>
            <strong>{startMeasure}</strong>
          </div>

          <div>
            <span>Ending Measure</span>
            <strong>{endMeasure}</strong>
          </div>
        </div>

        {/* US-06: Record a performance using the microphone. */}
        <div className="recording-section">

          {/* Microphone recording section heading. */}
          <div className="recording-section-header">
            <h2>Record Your Performance</h2>

            <p className="recording-description">
              Record your performance using your microphone,
              or upload an existing WAV file below.
            </p>
          </div>

          {/* Recording controls. */}
          <div className="recording-controls">
            {!isRecording ? (
              <button
                type="button"
                className="recording-start-button"
                onClick={handleStartRecording}
                disabled={recordingLoading || audioLoading}
              >
                {/* Microphone icon. */}
                <svg
                  className="recording-button-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect
                    x="9"
                    y="2"
                    width="6"
                    height="12"
                    rx="3"
                  />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>

                <span>
                  {recordingLoading
                    ? 'Preparing Recording...'
                    : 'Start Recording'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="recording-stop-button"
                onClick={handleStopRecording}
                disabled={audioLoading}
              >
                {/* Stop recording icon. */}
                <svg
                  className="recording-button-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect
                    x="6"
                    y="6"
                    width="12"
                    height="12"
                    rx="2"
                  />
                </svg>

                <span>Stop Recording</span>
              </button>
            )}
          </div>

          {/* Recording in progress status indicator. */}
          {isRecording && (
            <div
              className="recording-status"
              role="status"
            >
              <span
                className="recording-status-dot"
                aria-hidden="true"
              />

              <span>Recording in progress...</span>
            </div>
          )}

          {/* Completed recording and audio preview. */}
          {recordingUrl && (
            <div className="recording-preview">

              {/* Successful recording status indicator. */}
              <div
                className="recording-complete-status"
                role="status"
              >
                <svg
                  className="recording-complete-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m8 12 3 3 5-6" />
                </svg>

                <span>Recording Complete</span>
              </div>

              <h3>Recording Preview</h3>

              <p className="recording-preview-description">
                Listen to your recorded performance before
                submitting it for analysis.
              </p>

              {/* US-06: Custom recording audio player. */}
              <div className="recording-custom-player">

                {/* Hidden native audio element.
                    Playback is controlled by the custom UI. */}
                <audio
                  ref={recordingAudioRef}
                  className="recording-hidden-audio"
                  src={recordingUrl}
                  preload="metadata"
                  onLoadedMetadata={handleAudioMetadata}
                  onDurationChange={handleAudioMetadata}
                  onTimeUpdate={handlePlaybackTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handlePlaybackEnded}
                  onError={() => {
                    setIsPlaying(false)
                    setPlaybackError(
                      'Unable to load the recorded audio.'
                    )
                  }}
                />

                {/* Recording file information. */}
                <div className="recording-player-header">

                  <div
                    className="recording-player-file-icon"
                    aria-hidden="true"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 10v4" />
                      <path d="M6 6v12" />
                      <path d="M10 3v18" />
                      <path d="M14 7v10" />
                      <path d="M18 5v14" />
                      <path d="M22 10v4" />
                    </svg>
                  </div>

                  <div className="recording-player-file-info">
                    <strong>Your Recorded Performance</strong>
                    <span>recorded_performance.wav</span>
                  </div>

                  <span className="recording-player-format">
                    WAV
                  </span>
                </div>

                {/* Main playback controls. */}
                <div className="recording-player-main">

                  {/* Play and Pause button. */}
                  <button
                    type="button"
                    className="recording-player-play-button"
                    onClick={handlePlaybackToggle}
                    aria-label={
                      isPlaying
                        ? 'Pause recording'
                        : 'Play recording'
                    }
                    title={
                      isPlaying
                        ? 'Pause recording'
                        : 'Play recording'
                    }
                  >
                    {isPlaying ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <rect
                          x="6"
                          y="4"
                          width="4"
                          height="16"
                          rx="1"
                        />
                        <rect
                          x="14"
                          y="4"
                          width="4"
                          height="16"
                          rx="1"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M8 5.5v13l11-6.5z" />
                      </svg>
                    )}
                  </button>

                  {/* Seekable playback progress bar. */}
                  <div className="recording-player-timeline">
                    <input
                      type="range"
                      className="recording-player-progress"
                      min="0"
                      max={duration || 0}
                      step="0.01"
                      value={Math.min(currentTime, duration)}
                      onChange={handlePlaybackSeek}
                      disabled={duration <= 0}
                      aria-label="Recording playback position"
                      aria-valuetext={`${formatAudioTime(
                        currentTime
                      )} of ${formatAudioTime(duration)}`}
                      style={{
                        '--recording-progress':
                          `${playbackProgress}%`,
                      }}
                    />

                    {/* Current time and total duration. */}
                    <div className="recording-player-time">
                      <span>
                        {formatAudioTime(currentTime)}
                      </span>

                      <span>
                        {formatAudioTime(duration)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Volume and mute controls. */}
                <div className="recording-player-bottom">

                  <div className="recording-player-volume">

                    <button
                      type="button"
                      className="recording-player-volume-button"
                      onClick={handleMuteToggle}
                      aria-label={
                        isMuted || volume === 0
                          ? 'Unmute recording'
                          : 'Mute recording'
                      }
                      title={
                        isMuted || volume === 0
                          ? 'Unmute recording'
                          : 'Mute recording'
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M11 5 6 9H3v6h3l5 4V5z" />

                        {isMuted || volume === 0 ? (
                          <>
                            <path d="m16 9 6 6" />
                            <path d="m22 9-6 6" />
                          </>
                        ) : (
                          <>
                            <path d="M15 9a4 4 0 0 1 0 6" />
                            <path d="M18 5a9 9 0 0 1 0 14" />
                          </>
                        )}
                      </svg>
                    </button>

                    <input
                      type="range"
                      className="recording-player-volume-slider"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Recording playback volume"
                      aria-valuetext={`${Math.round(
                        (isMuted ? 0 : volume) * 100
                      )}%`}
                      style={{
                        '--recording-volume':
                          `${volumeProgress}%`,
                      }}
                    />

                    <span className="recording-player-volume-value">
                      {Math.round(
                        (isMuted ? 0 : volume) * 100
                      )}%
                    </span>
                  </div>

                  <span className="recording-player-duration">
                    {formatAudioTime(duration)} duration
                  </span>
                </div>

                {/* Audio playback error message. */}
                {playbackError && (
                  <p
                    className="recording-player-error"
                    role="alert"
                  >
                    {playbackError}
                  </p>
                )}
              </div>

              {/* Discard the recording and allow another attempt. */}
              <button
                type="button"
                className="recording-discard-button"
                onClick={handleDiscardRecording}
                disabled={audioLoading}
              >
                {/* Trash icon. */}
                <svg
                  className="recording-button-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>

                <span>Discard Recording</span>
              </button>
            </div>
          )}
        </div>

        {/* Existing WAV file upload section. */}
        <div className="upload-section">
          <label className="file-label">
            Choose Audio File

            <input
              type="file"
              accept=".wav,audio/wav"
              onChange={handleAudioFileChange}
            />
          </label>

          {audioFile && (
            <div className="selected-file">
              Selected file:
              <strong>{audioFile.name}</strong>
            </div>
          )}

          <button
            className="upload-button"
            onClick={handleAudioUpload}
            disabled={audioLoading || isRecording || recordingLoading}
          >
            {audioLoading
              ? 'Processing Audio...'
              : 'Upload Performance'}
          </button>
        </div>

        {audioMessage && (
          <div className="message">
            {audioMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export default PerformanceUpload