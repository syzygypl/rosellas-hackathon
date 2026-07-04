import { Module } from '@nestjs/common';
import { SolverController } from './solver.controller';
import { SolverService } from './solver.service';
import { TrizMcpService } from './triz-mcp.service';
import { AgentService } from './agent.service';
import { ChatService } from './chat.service';
import { LangfuseTracingService } from './langfuse-tracing.service';

@Module({
  controllers: [SolverController],
  providers: [SolverService, TrizMcpService, AgentService, ChatService, LangfuseTracingService],
})
export class AppModule {}
