import 'reflect-metadata';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  UploadedAudioFile,
  VoiceService,
  filenameForMimeType,
  truncateForSpeech,
} from './voice.service';

const tracingStub = {
  trace: (_name: string, _options: unknown, fn: (ctx: unknown) => Promise<unknown>) => fn({}),
} as never;

function agentStub(configured: boolean) {
  return {
    isConfigured: () => configured,
    configurationError: () => 'OpenAI agent is disabled.',
    openAiKey: () => (configured ? 'test-key' : ''),
  } as never;
}

function audioFile(bytes = 8): UploadedAudioFile {
  return {
    buffer: Buffer.alloc(bytes, 1),
    mimetype: 'audio/webm;codecs=opus',
    size: bytes,
    originalname: 'blob',
  };
}

describe('VoiceService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('transcribe', () => {
    it('rejects a missing or empty upload', async () => {
      const service = new VoiceService(agentStub(true), tracingStub);

      await expect(service.transcribe(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.transcribe(audioFile(0))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('answers 503 when no OpenAI key is configured', async () => {
      const service = new VoiceService(agentStub(false), tracingStub);

      await expect(service.transcribe(audioFile())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('posts the audio to the OpenAI transcription API and trims the text', async () => {
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ text: '  Cześć świecie  ' }),
      } as never);
      const service = new VoiceService(agentStub(true), tracingStub);

      await expect(service.transcribe(audioFile())).resolves.toEqual({ text: 'Cześć świecie' });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
      const form = init.body as FormData;
      expect(form.get('model')).toBe('gpt-4o-transcribe');
      expect((form.get('file') as File).name).toBe('speech.webm');
    });

    it('maps upstream failures to 503 without leaking the response body', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'invalid api key',
      } as never);
      const service = new VoiceService(agentStub(true), tracingStub);

      await expect(service.transcribe(audioFile())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('speak', () => {
    it('rejects empty text', async () => {
      const service = new VoiceService(agentStub(true), tracingStub);

      await expect(service.speak(undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.speak('   ')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('answers 503 when no OpenAI key is configured', async () => {
      const service = new VoiceService(agentStub(false), tracingStub);

      await expect(service.speak('Cześć')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('returns the synthesized audio as a Buffer', async () => {
      const audio = Uint8Array.from([1, 2, 3]);
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: async () => audio.buffer,
      } as never);
      const service = new VoiceService(agentStub(true), tracingStub);

      const result = await service.speak('Cześć, to test.');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect([...result]).toEqual([1, 2, 3]);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.openai.com/v1/audio/speech');
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: 'Cześć, to test.',
        response_format: 'mp3',
      });
    });
  });
});

describe('filenameForMimeType', () => {
  it('maps recorder mime types to filenames OpenAI accepts', () => {
    expect(filenameForMimeType('audio/webm;codecs=opus')).toBe('speech.webm');
    expect(filenameForMimeType('audio/webm')).toBe('speech.webm');
    expect(filenameForMimeType('audio/mp4')).toBe('speech.mp4');
    expect(filenameForMimeType('audio/ogg;codecs=opus')).toBe('speech.ogg');
    expect(filenameForMimeType('audio/mpeg')).toBe('speech.mp3');
    expect(filenameForMimeType('')).toBe('speech.webm');
    expect(filenameForMimeType('application/octet-stream')).toBe('speech.webm');
  });
});

describe('truncateForSpeech', () => {
  it('keeps short text unchanged', () => {
    expect(truncateForSpeech('Krótki tekst.')).toBe('Krótki tekst.');
  });

  it('cuts overlong text at a sentence boundary under the 4096-char cap', () => {
    const sentence = 'To jest zdanie testowe numer jeden. ';
    const text = sentence.repeat(200); // 7200 chars
    const result = truncateForSpeech(text);

    expect(result.length).toBeLessThanOrEqual(4096);
    expect(result.endsWith('.')).toBe(true);
  });

  it('falls back to a hard cut when there is no usable sentence boundary', () => {
    const result = truncateForSpeech('x'.repeat(5000));

    expect(result).toHaveLength(4096);
  });
});
