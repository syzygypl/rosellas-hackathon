import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VersionDto } from './version.dto';

@ApiTags('version')
@Controller('version')
export class VersionController {
  @Get()
  @ApiOperation({ summary: 'Application version metadata' })
  @ApiOkResponse({ type: VersionDto })
  getVersion(): VersionDto {
    return {
      version: process.env.APP_VERSION ?? 'local',
      commitSha: process.env.GIT_SHA ?? 'local',
      buildTime: process.env.BUILD_TIME ?? new Date(0).toISOString(),
    };
  }
}
