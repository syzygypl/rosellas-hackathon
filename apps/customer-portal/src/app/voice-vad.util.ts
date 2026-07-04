/**
 * Pure voice-activity-detection reducer: the capture service feeds it one RMS
 * sample per tick and acts on the returned decision. Keeping the logic pure
 * makes it unit-testable — browser audio APIs are not available under jest.
 */

export interface VadConfig {
  /** RMS level treated as speech. */
  speechRmsThreshold: number;
  /** Silence after speech that ends the utterance. */
  silenceMs: number;
  /** Shorter voiced blips (coughs, clicks) are discarded. */
  minSpeechMs: number;
  /** Hard cap: capture even if the user is still talking. */
  maxUtteranceMs: number;
  /** Recorder restart when nobody has spoken at all (bounds blob size). */
  noSpeechTimeoutMs: number;
}

export const DEFAULT_VAD_CONFIG: VadConfig = {
  speechRmsThreshold: 0.02,
  silenceMs: 1200,
  minSpeechMs: 300,
  maxUtteranceMs: 30000,
  noSpeechTimeoutMs: 20000,
};

export interface VadState {
  startedAt: number;
  speechStartedAt: number | null;
  lastVoiceAt: number | null;
}

/** 'capture' = emit the recording, 'discard' = drop it and re-arm the recorder. */
export type VadDecision = 'continue' | 'capture' | 'discard';

export function initialVadState(now: number): VadState {
  return { startedAt: now, speechStartedAt: null, lastVoiceAt: null };
}

export function vadStep(
  state: VadState,
  rms: number,
  now: number,
  cfg: VadConfig = DEFAULT_VAD_CONFIG,
): { state: VadState; decision: VadDecision } {
  const voiced = rms >= cfg.speechRmsThreshold;
  const next: VadState = voiced
    ? {
        startedAt: state.startedAt,
        speechStartedAt: state.speechStartedAt ?? now,
        lastVoiceAt: now,
      }
    : state;

  if (next.speechStartedAt === null || next.lastVoiceAt === null) {
    const decision: VadDecision =
      now - next.startedAt >= cfg.noSpeechTimeoutMs ? 'discard' : 'continue';
    return { state: next, decision };
  }

  const speechMs = next.lastVoiceAt - next.speechStartedAt;
  const longEnough = speechMs >= cfg.minSpeechMs;

  if (now - next.startedAt >= cfg.maxUtteranceMs) {
    return { state: next, decision: longEnough ? 'capture' : 'discard' };
  }
  if (!voiced && now - next.lastVoiceAt >= cfg.silenceMs) {
    return { state: next, decision: longEnough ? 'capture' : 'discard' };
  }
  return { state: next, decision: 'continue' };
}
