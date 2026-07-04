import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  DEFAULT_VAD_CONFIG,
  VadState,
  initialVadState,
  vadStep,
} from '../voice-vad.util';

/** MediaRecorder containers OpenAI transcription accepts, best first. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4', // Safari
  'audio/ogg;codecs=opus',
];

const VAD_POLL_MS = 50;
const ANALYSER_FFT_SIZE = 2048;

/**
 * Hands-free microphone capture: keeps one mic stream open for the voice
 * session, records with MediaRecorder and uses an RMS voice-activity detector
 * to emit one Blob per utterance. The recorder and VAD run only while
 * listening, so the app never records its own TTS playback.
 */
@Injectable({ providedIn: 'root' })
export class VoiceCaptureService {
  readonly listening = signal(false);
  /** Emits one audio blob per detected utterance. */
  readonly utterance$ = new Subject<Blob>();

  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private vadState: VadState = initialVadState(0);
  private mimeType = '';

  /** Ask for the mic and build the analyser. Throws when permission is denied. */
  async enable(): Promise<void> {
    if (this.stream) {
      return;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.mimeType =
      MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    this.audioContext = new AudioContext();
    // Safari creates contexts suspended; resume within the user gesture.
    await this.audioContext.resume().catch(() => undefined);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
    this.samples = new Float32Array(this.analyser.fftSize);
  }

  startListening(): void {
    if (!this.stream || this.listening()) {
      return;
    }
    this.listening.set(true);
    this.armRecorder();
    this.vadTimer = setInterval(() => this.pollVad(), VAD_POLL_MS);
  }

  stopListening(): void {
    this.listening.set(false);
    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    const recorder = this.recorder;
    this.recorder = null;
    this.chunks = [];
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
  }

  /** Release the mic entirely (voice mode off / component destroyed). */
  disable(): void {
    this.stopListening();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.analyser = null;
    this.samples = null;
  }

  private armRecorder(): void {
    if (!this.stream) {
      return;
    }
    this.chunks = [];
    const recorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        this.chunks.push(event.data);
      }
    };
    recorder.start(250);
    this.recorder = recorder;
    this.vadState = initialVadState(Date.now());
  }

  private pollVad(): void {
    if (!this.analyser || !this.samples || !this.recorder) {
      return;
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) {
      sum += this.samples[i] * this.samples[i];
    }
    const rms = Math.sqrt(sum / this.samples.length);

    const { state, decision } = vadStep(this.vadState, rms, Date.now(), DEFAULT_VAD_CONFIG);
    this.vadState = state;
    if (decision === 'capture') {
      this.finishUtterance();
    } else if (decision === 'discard') {
      this.restartRecorder();
    }
  }

  /** Stop and emit the utterance once the recorder flushes its last chunk. */
  private finishUtterance(): void {
    const recorder = this.recorder;
    if (!recorder) {
      return;
    }
    this.recorder = null;
    this.listening.set(false);
    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
      this.chunks = [];
      this.utterance$.next(blob);
    };
    recorder.stop();
  }

  /** Drop accumulated silence/blips and keep listening with a fresh recorder. */
  private restartRecorder(): void {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder) {
      return;
    }
    recorder.onstop = () => {
      if (this.listening()) {
        this.armRecorder();
      }
    };
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }
}
