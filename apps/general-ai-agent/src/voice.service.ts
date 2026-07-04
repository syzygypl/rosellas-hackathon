import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { LangfuseTracingService } from './langfuse-tracing.service';

export interface TranscribeResult {
  text: string;
}

export interface SpeakRequest {
  text?: string;
}

/** Shape of a multer memory-storage upload — local so @types/multer stays out. */
export interface UploadedAudioFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/** OpenAI /v1/audio/speech rejects inputs longer than 4096 characters. */
const MAX_TTS_INPUT_CHARS = 4096;
export const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;

const OPENAI_AUDIO_BASE = 'https://api.openai.com/v1/audio';

/** Map a MediaRecorder mime type to a filename OpenAI recognizes. */
export function filenameForMimeType(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  switch (base) {
    case 'audio/mp4':
      return 'speech.mp4';
    case 'audio/ogg':
      return 'speech.ogg';
    case 'audio/mpeg':
      return 'speech.mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'speech.wav';
    default:
      return 'speech.webm';
  }
}

/**
 * Voice endpoints for the portal's hands-free chat mode: speech-to-text and
 * text-to-speech through the OpenAI audio APIs. Unlike the chat, voice has no
 * LLM-free fallback, so both calls answer 503 when no OpenAI key is set.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly sttModel = process.env.VOICE_STT_MODEL || 'gpt-4o-transcribe';
  private readonly ttsModel = process.env.VOICE_TTS_MODEL || 'gpt-4o-mini-tts';
  private readonly ttsVoice = process.env.VOICE_TTS_VOICE || 'alloy';

  constructor(
    private readonly agent: AgentService,
    private readonly tracing: LangfuseTracingService,
  ) {}

  async transcribe(file: UploadedAudioFile | undefined): Promise<TranscribeResult> {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Missing audio recording: expected a non-empty "audio" file field.');
    }
    this.ensureConfigured();

    return this.tracing.trace(
      'api.voice.transcribe',
      {
        // Only audio metadata goes to the trace, never the recording itself.
        input: { bytes: file.size, mimeType: file.mimetype },
        metadata: { route: 'POST /api/voice/transcribe', model: this.sttModel },
        tags: ['api', 'voice'],
      },
      async () => {
        const form = new FormData();
        form.append(
          'file',
          new File([new Uint8Array(file.buffer)], filenameForMimeType(file.mimetype), {
            type: file.mimetype || 'audio/webm',
          }),
        );
        form.append('model', this.sttModel);

        const response = await fetch(`${OPENAI_AUDIO_BASE}/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.agent.openAiKey()}` },
          body: form,
        });
        if (!response.ok) {
          await this.throwUpstreamError('transcription', response);
        }
        const json = (await response.json()) as { text?: string };
        return { text: (json.text ?? '').trim() };
      },
    );
  }

  async speak(text: string | undefined): Promise<Buffer> {
    const input = truncateForSpeech((text ?? '').trim());
    if (!input) {
      throw new BadRequestException('Missing text: expected a non-empty "text" field.');
    }
    this.ensureConfigured();

    return this.tracing.trace(
      'api.voice.speak',
      {
        input: { chars: input.length },
        metadata: { route: 'POST /api/voice/speak', model: this.ttsModel, voice: this.ttsVoice },
        tags: ['api', 'voice'],
        output: { audio: 'mp3' },
      },
      async () => {
        const response = await fetch(`${OPENAI_AUDIO_BASE}/speech`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.agent.openAiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.ttsModel,
            voice: this.ttsVoice,
            input,
            response_format: 'mp3',
          }),
        });
        if (!response.ok) {
          await this.throwUpstreamError('speech synthesis', response);
        }
        return Buffer.from(await response.arrayBuffer());
      },
    );
  }

  private ensureConfigured(): void {
    if (!this.agent.isConfigured()) {
      throw new ServiceUnavailableException(this.agent.configurationError());
    }
  }

  private async throwUpstreamError(operation: string, response: Response): Promise<never> {
    const body = (await response.text().catch(() => '')).slice(0, 300);
    this.logger.error(`OpenAI ${operation} failed (HTTP ${response.status}): ${body}`);
    throw new ServiceUnavailableException(`OpenAI ${operation} failed (HTTP ${response.status}).`);
  }
}

/** Cap TTS input at the OpenAI limit, cutting at a sentence boundary when possible. */
export function truncateForSpeech(text: string): string {
  if (text.length <= MAX_TTS_INPUT_CHARS) return text;
  const slice = text.slice(0, MAX_TTS_INPUT_CHARS);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  return lastSentenceEnd > MAX_TTS_INPUT_CHARS / 2 ? slice.slice(0, lastSentenceEnd + 1) : slice;
}
