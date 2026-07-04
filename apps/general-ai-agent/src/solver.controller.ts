import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { SolverService, SolveRequest } from './solver.service';
import { AgentService } from './agent.service';
import { ChatService, ChatRequest } from './chat.service';

@Controller()
export class SolverController {
  constructor(
    private readonly solver: SolverService,
    private readonly agent: AgentService,
    private readonly chatService: ChatService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('version')
  version() {
    return {
      version: process.env.APP_VERSION ?? 'local',
      commitSha: process.env.GIT_SHA ?? 'local',
      buildTime: process.env.BUILD_TIME ?? new Date(0).toISOString(),
    };
  }

  @Post('solve')
  @Header('Content-Type', 'application/json')
  async solve(@Body() body: SolveRequest) {
    return this.solver.solve(body);
  }

  @Post('agent/solve')
  @Header('Content-Type', 'application/json')
  async agentSolve(@Body() body: SolveRequest) {
    return this.agent.solve(body.problem);
  }

  @Post('chat')
  @Header('Content-Type', 'application/json')
  async chat(@Body() body: ChatRequest) {
    return this.chatService.chat(body);
  }
}
