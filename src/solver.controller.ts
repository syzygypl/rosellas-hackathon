import { Body, Controller, Get, Header, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { SolverService, SolveRequest } from './solver.service';
import { AgentService } from './agent.service';

@Controller()
export class SolverController {
  constructor(
    private readonly solver: SolverService,
    private readonly agent: AgentService,
  ) {}

  @Get()
  serveUi(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('api/solve')
  @Header('Content-Type', 'application/json')
  async solve(@Body() body: SolveRequest) {
    return this.solver.solve(body);
  }

  @Post('api/agent/solve')
  @Header('Content-Type', 'application/json')
  async agentSolve(@Body() body: SolveRequest) {
    return this.agent.solve(body.problem);
  }
}
