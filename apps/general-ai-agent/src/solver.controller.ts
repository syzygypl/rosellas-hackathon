import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { SolverService, SolveRequest } from './solver.service';

@Controller()
export class SolverController {
  constructor(private readonly solver: SolverService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('solve')
  @Header('Content-Type', 'application/json')
  async solve(@Body() body: SolveRequest) {
    return this.solver.solve(body);
  }
}
