import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '../common/slug';
import { Category, Language } from '../database/entities';
import { t } from '../i18n/i18n';
import { CategoryInputDto, CategoryUpdateDto, LanguageInputDto, LanguageUpdateDto } from './dto/catalog.dto';

/** Admin management of categories and languages. Slugs are generated from names and kept unique. */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Language) private readonly languages: Repository<Language>,
  ) {}

  listCategories(): Promise<Category[]> {
    return this.categories.find({ order: { name: 'ASC' } });
  }

  async createCategory(dto: CategoryInputDto): Promise<Category> {
    return this.categories.save(
      this.categories.create({
        name: dto.name.trim(),
        slug: await this.uniqueSlug(this.categories, dto.name, 'category'),
        description: dto.description ?? null,
        isActive: true,
      }),
    );
  }

  async updateCategory(id: string, dto: CategoryUpdateDto): Promise<Category> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException(t('catalog.notFound'));
    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    return this.categories.save(category);
  }

  listLanguages(): Promise<Language[]> {
    return this.languages.find({ order: { name: 'ASC' } });
  }

  async createLanguage(dto: LanguageInputDto): Promise<Language> {
    const code = dto.code.toLowerCase();
    if (await this.languages.exists({ where: { code } })) {
      throw new ConflictException(t('catalog.codeTaken'));
    }
    return this.languages.save(
      this.languages.create({
        name: dto.name.trim(),
        code,
        slug: await this.uniqueSlug(this.languages, dto.name, 'language'),
        isActive: true,
      }),
    );
  }

  async updateLanguage(id: string, dto: LanguageUpdateDto): Promise<Language> {
    const language = await this.languages.findOne({ where: { id } });
    if (!language) throw new NotFoundException(t('catalog.notFound'));
    if (dto.name !== undefined) language.name = dto.name.trim();
    if (dto.isActive !== undefined) language.isActive = dto.isActive;
    return this.languages.save(language);
  }

  private async uniqueSlug<T extends { slug: string }>(repo: Repository<T>, name: string, fallback: string): Promise<string> {
    const base = slugify(name, fallback);
    let slug = base;
    let n = 2;
    while (await repo.exists({ where: { slug } as never })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }
}
