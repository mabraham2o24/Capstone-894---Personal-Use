
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
      navigate('/performance-results', {
        state: {
          sessionId: sessionId,
          scoreResult: scoreResult,
          audioResult: audioData,
          startMeasure: startMeasure,
          endMeasure: endMeasure,
        },
      })
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
          Upload a WAV recording of your performance.
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
          <h2>Record Your Performance</h2>

          <p>
            Record your performance using your microphone,
            or upload an existing WAV file below.
          </p>

          <div className="recording-controls">
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={recordingLoading || audioLoading}
              >
                {recordingLoading
                  ? 'Preparing Microphone...'
                  : 'Start Recording'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                disabled={audioLoading}
              >
                Stop Recording
              </button>
            )}
          </div>

          {isRecording && (
            <p role="status">Recording in progress...</p>
          )}

          {recordingUrl && (
            <div className="recording-preview">
              <h3>Recording Preview</h3>

              <audio controls src={recordingUrl}>
                Your browser does not support audio playback.
              </audio>

              <button
                type="button"
                onClick={handleDiscardRecording}
                disabled={audioLoading}
              >
                Discard Recording
              </button>
            </div>
          )}
        </div>

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
