import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'Buy milk' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: '2% organic' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateItemDto {
  @ApiPropertyOptional({ example: 'Buy oat milk' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Barista edition' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class ItemDto {
  @ApiProperty({ example: 'abc123' })
  id!: string;

  @ApiProperty({ example: 'Buy milk' })
  title!: string;

  @ApiProperty({ example: '2% organic' })
  description!: string;

  @ApiProperty({ example: '2026-07-03T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-03T12:00:00.000Z' })
  updatedAt!: string;
}

export class DeleteItemResponseDto {
  @ApiProperty({ example: true })
  deleted!: boolean;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
