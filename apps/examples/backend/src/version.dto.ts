import { ApiProperty } from '@nestjs/swagger';

export class VersionDto {
  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: '28bba4a2008b5b2aec8ab8c343083b2ab31bbe4b' })
  commitSha!: string;

  @ApiProperty({ example: '2026-07-04T09:10:00Z' })
  buildTime!: string;
}
