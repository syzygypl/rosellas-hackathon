import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateItemDto,
  DeleteItemResponseDto,
  ItemDto,
  UpdateItemDto,
} from './item.dto';
import { ItemsService } from './items.service';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List all items' })
  @ApiOkResponse({ type: ItemDto, isArray: true })
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by id' })
  @ApiParam({ name: 'id', example: 'abc123' })
  @ApiOkResponse({ type: ItemDto })
  @ApiNotFoundResponse({ description: 'Item not found' })
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create item' })
  @ApiCreatedResponse({ type: ItemDto })
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update item' })
  @ApiParam({ name: 'id', example: 'abc123' })
  @ApiOkResponse({ type: ItemDto })
  @ApiNotFoundResponse({ description: 'Item not found' })
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete item' })
  @ApiParam({ name: 'id', example: 'abc123' })
  @ApiOkResponse({ type: DeleteItemResponseDto })
  @ApiNotFoundResponse({ description: 'Item not found' })
  async remove(@Param('id') id: string) {
    await this.itemsService.remove(id);
    return { deleted: true };
  }
}
