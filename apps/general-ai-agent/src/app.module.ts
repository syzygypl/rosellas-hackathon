import { Module } from '@nestjs/common';
import { SolverController } from './solver.controller';
import { SolverService } from './solver.service';
import { TrizMcpService } from './triz-mcp.service';
import { AgentService } from './agent.service';
import { ChatService } from './chat.service';
import { LangfuseTracingService } from './langfuse-tracing.service';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  controllers: [SolverController, VoiceController],
  providers: [
    SolverService,
    TrizMcpService,
    AgentService,
    ChatService,
    LangfuseTracingService,
    VoiceService,
  ],
})
export class AppModule {}
