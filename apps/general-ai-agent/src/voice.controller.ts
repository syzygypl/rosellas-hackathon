import {
  Body,
  Controller,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  MAX_AUDIO_UPLOAD_BYTES,
  SpeakRequest,
  TranscribeResult,
  UploadedAudioFile,
  VoiceService,
} from './voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_UPLOAD_BYTES } }))
  transcribe(@UploadedFile() file?: UploadedAudioFile): Promise<TranscribeResult> {
    return this.voice.transcribe(file);
  }

  @Post('speak')
  async speak(
    @Body() body: SpeakRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const audio = await this.voice.speak(body?.text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(audio);
  }
}
