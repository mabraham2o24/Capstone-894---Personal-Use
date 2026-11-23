
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.isRecording = true

    this.port.onmessage = (event) => {
      if (event.data?.type === 'stop') {
        this.isRecording = false

        // Messages sent through the same port are ordered.
        // All earlier audio messages precede this acknowledgment.
        this.port.postMessage({ type: 'stopped' })
      }
    }
  }

  process(inputs, outputs) {
    // Keep microphone audio from playing through speakers.
    for (const output of outputs) {
      for (const channel of output) {
        channel.fill(0)
      }
    }

    if (!this.isRecording) return true

    const samples = inputs[0]?.[0]

    if (samples?.length) {
      this.port.postMessage({
        type: 'audio',
        samples: new Float32Array(samples),
      })
    }

    return true
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor)
