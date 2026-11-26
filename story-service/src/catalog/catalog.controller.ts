import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import { CatalogService } from './catalog.service';
import { CategoryInputDto, CategoryUpdateDto, LanguageInputDto, LanguageUpdateDto } from './dto/catalog.dto';

@ApiTags('Admin catalogue')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryInputDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryUpdateDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @Get('languages')
  listLanguages() {
    return this.catalog.listLanguages();
  }

  @Post('languages')
  createLanguage(@Body() dto: LanguageInputDto) {
    return this.catalog.createLanguage(dto);
  }

  @Patch('languages/:id')
  updateLanguage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LanguageUpdateDto) {
    return this.catalog.updateLanguage(id, dto);
  }
}
