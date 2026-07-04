import { Module } from '@nestjs/common';
import { SolverController } from './solver.controller';
import { SolverService } from './solver.service';
import { TrizMcpService } from './triz-mcp.service';

@Module({
  controllers: [SolverController],
  providers: [SolverService, TrizMcpService],
})
export class AppModule {}
