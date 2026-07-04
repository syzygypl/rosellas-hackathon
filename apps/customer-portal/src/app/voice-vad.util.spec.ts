import {
  DEFAULT_VAD_CONFIG,
  VadConfig,
  VadState,
  initialVadState,
  vadStep,
} from './voice-vad.util';

const cfg: VadConfig = { ...DEFAULT_VAD_CONFIG };
const SPEECH = cfg.speechRmsThreshold + 0.01;
const SILENCE = 0;

/** Run a (rms, at) sample sequence, returning the first non-continue decision. */
function run(samples: Array<[number, number]>): {
  state: VadState;
  decision: string;
  decidedAt: number | null;
} {
  let state = initialVadState(0);
  for (const [rms, at] of samples) {
    const step = vadStep(state, rms, at, cfg);
    state = step.state;
    if (step.decision !== 'continue') {
      return { state, decision: step.decision, decidedAt: at };
    }
  }
  return { state, decision: 'continue', decidedAt: null };
}

describe('vadStep', () => {
  it('continues while the user is speaking', () => {
    const result = run([
      [SPEECH, 100],
      [SPEECH, 500],
      [SPEECH, 1000],
      [SILENCE, 1500],
    ]);

    expect(result.decision).toBe('continue');
  });

  it('captures once silence follows enough speech', () => {
    const result = run([
      [SPEECH, 100],
      [SPEECH, 600],
      [SILENCE, 700],
      [SILENCE, 600 + cfg.silenceMs],
    ]);

    expect(result.decision).toBe('capture');
    expect(result.decidedAt).toBe(600 + cfg.silenceMs);
  });

  it('discards a sub-minSpeechMs blip followed by silence', () => {
    const result = run([
      [SPEECH, 100],
      [SPEECH, 200], // 100ms of speech < minSpeechMs
      [SILENCE, 300],
      [SILENCE, 200 + cfg.silenceMs],
    ]);

    expect(result.decision).toBe('discard');
  });

  it('discards when nobody speaks for noSpeechTimeoutMs', () => {
    const result = run([
      [SILENCE, 1000],
      [SILENCE, cfg.noSpeechTimeoutMs],
    ]);

    expect(result.decision).toBe('discard');
  });

  it('force-captures a monologue at maxUtteranceMs', () => {
    const samples: Array<[number, number]> = [];
    for (let at = 0; at <= cfg.maxUtteranceMs; at += 500) {
      samples.push([SPEECH, at]);
    }
    const result = run(samples);

    expect(result.decision).toBe('capture');
    expect(result.decidedAt).toBe(cfg.maxUtteranceMs);
  });

  it('tracks speech start and last voice timestamps', () => {
    let state = initialVadState(0);
    state = vadStep(state, SILENCE, 100, cfg).state;
    state = vadStep(state, SPEECH, 200, cfg).state;
    state = vadStep(state, SPEECH, 700, cfg).state;
    state = vadStep(state, SILENCE, 900, cfg).state;

    expect(state.speechStartedAt).toBe(200);
    expect(state.lastVoiceAt).toBe(700);
  });
});
