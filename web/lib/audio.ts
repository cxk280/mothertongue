// Microphone capture + PCM framing + playback.
// The pure conversion helpers (floatToPcm16, resampleLinear) are unit-tested; the
// MicCapture class is browser-only and used from the call hook.

/** Convert float32 samples in [-1, 1] to little-endian PCM16 bytes. */
export function floatToPcm16(input: Float32Array): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(input.length * 2));
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view.buffer;
}

/** Linear-resample a mono buffer. Cheap and good enough for speech at 16 kHz. */
export function resampleLinear(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate || input.length === 0) return input;
  const ratio = inRate / outRate;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const a = input[i0];
    const b = input[i0 + 1] ?? a;
    out[i] = a * (1 - frac) + b * frac;
  }
  return out;
}

/** Root-mean-square level of a buffer, for the speaking VU meter. */
export function rms(input: Float32Array): number {
  if (input.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  return Math.sqrt(sum / input.length);
}

export class MicCapture {
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: ScriptProcessorNode;
  private source?: MediaStreamAudioSourceNode;
  private sink?: GainNode;

  constructor(
    private targetRate: number,
    private onFrame: (pcm: ArrayBuffer) => void,
    private onLevel?: (level: number) => void,
  ) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    try {
      // Building the audio graph can still throw (e.g. a browser that rejects a forced
      // 16 kHz AudioContext). If it does, release the mic we just acquired before rethrowing
      // so the OS mic indicator doesn't stay on.
      this.ctx = new AudioContext({ sampleRate: this.targetRate });
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.node = this.ctx.createScriptProcessor(4096, 1, 1);
      this.node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const frames = resampleLinear(input, this.ctx!.sampleRate, this.targetRate);
        this.onLevel?.(rms(frames));
        this.onFrame(floatToPcm16(frames));
      };
      // Route through a muted gain so the graph pulls audio without echoing to speakers.
      this.sink = this.ctx.createGain();
      this.sink.gain.value = 0;
      this.source.connect(this.node);
      this.node.connect(this.sink);
      this.sink.connect(this.ctx.destination);
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  stop(): void {
    this.node?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = undefined;
  }
}

/** Play a base64 WAV and resolve when it finishes (or fails). */
export function playWavBase64(b64: string, mime = "audio/wav"): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(`data:${mime};base64,${b64}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
}
