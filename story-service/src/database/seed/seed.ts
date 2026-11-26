import 'reflect-metadata';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import * as argon2 from 'argon2';
import { AppConfig } from '../../config/app-config';
import { buildDataSourceOptions } from '../database.options';
import {
  AccessType,
  ApplicationSetting,
  Category,
  Language,
  PublishedSnapshot,
  Story,
  StoryPage,
  StoryStatus,
  SubscriptionPlan,
  User,
  UserRole,
  UserRoleEntity,
} from '../entities';
import seedData from './seed-data.json';
import sampleStoryData from './sample-stories.json';

/** Free, published sample stories so the public site has content to read. Idempotent by slug. */
async function seedSampleStories(ds: DataSource, cfg: AppConfig): Promise<void> {
  const stories = ds.getRepository(Story);
  const pages = ds.getRepository(StoryPage);
  const users = ds.getRepository(User);
  const categories = ds.getRepository(Category);
  const languages = ds.getRepository(Language);

  for (const sample of sampleStoryData.sampleStories) {
    // Non-Latin titles need an explicit slug; Latin titles get one derived from the title.
    const explicitSlug = (sample as { slug?: string }).slug;
    const slug =
      explicitSlug ??
      sample.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (await stories.findOne({ where: { slug } })) {
      console.log(`[seed] sample story ${slug} already exists; left unchanged`);
      continue;
    }

    const author = await users.findOne({ where: { email: sampleStoryData.authorEmail } });
    const category = await categories.findOne({ where: { slug: sample.categorySlug } });
    const language = await languages.findOne({ where: { code: sample.languageCode } });
    if (!author || !category || !language) {
      throw new Error(`Sample story "${sample.title}" needs its author, category and language to exist first.`);
    }

    const now = new Date();
    const story = await stories.save(
      stories.create({
        authorId: author.id,
        categoryId: category.id,
        languageId: language.id,
        title: sample.title,
        slug,
        description: sample.description,
        accessType: AccessType.FREE,
        pricePaise: 0,
        freePreviewPages: cfg.stories.defaultFreePreviewPages,
        publicationStatus: StoryStatus.PUBLISHED,
        publishedAt: now,
        viewCount: 0,
      }),
    );

    const snapshotPages = sample.pages.map((page, index) => ({
      pageNumber: index + 1,
      title: page.title,
      content: page.content,
    }));
    for (const page of snapshotPages) {
      await pages.save(
        pages.create({
          storyId: story.id,
          pageNumber: page.pageNumber,
          displayOrder: page.pageNumber,
          title: page.title,
          content: page.content,
        }),
      );
    }

    const snapshot: PublishedSnapshot = {
      title: sample.title,
      description: sample.description,
      coverImageUrl: null,
      publishedAt: now.toISOString(),
      pages: snapshotPages,
    };
    story.publishedSnapshot = snapshot;
    await stories.save(story);
    console.log(`[seed] created published sample story "${sample.title}" with ${snapshotPages.length} pages`);
  }
}

/**
 * Idempotent seed: safe to run repeatedly.
 * Admin and sample-user passwords come from .env; accounts and reference data from seed-data.json.
 */

const MIN_PASSWORD_LENGTH = 12;

async function seedAdmin(ds: DataSource, cfg: AppConfig): Promise<void> {
  const email = cfg.seed.adminEmail.trim().toLowerCase();
  const password = cfg.seed.adminPassword;
  if (!email || !password) {
    console.warn('[seed] ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD are empty; skipping admin creation.');
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_SEED_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const users = ds.getRepository(User);
  const roles = ds.getRepository(UserRoleEntity);

  let admin = await users.findOne({ where: { email } });
  if (!admin) {
    admin = await users.save(
      users.create({
        fullName: cfg.seed.adminName,
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        emailVerified: true,
        isActive: true,
      }),
    );
    console.log(`[seed] created admin ${email}`);
  } else {
    console.log(`[seed] admin ${email} already exists; password left unchanged`);
  }

  const hasRole = await roles.findOne({ where: { userId: admin.id, role: UserRole.ADMIN } });
  if (!hasRole) {
    await roles.save(roles.create({ userId: admin.id, role: UserRole.ADMIN }));
  }
}

/** Creates verified sample accounts defined in seed-data.json. Password comes from .env. */
async function seedSampleUsers(ds: DataSource, cfg: AppConfig): Promise<void> {
  const password = cfg.sampleUsers.password;
  if (seedData.sampleUsers.length === 0) return;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_SAMPLE_USER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const users = ds.getRepository(User);
  const roles = ds.getRepository(UserRoleEntity);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  for (const sample of seedData.sampleUsers) {
    const email = sample.email.trim().toLowerCase();
    let user = await users.findOne({ where: { email } });
    if (!user) {
      user = await users.save(
        users.create({
          fullName: sample.fullName,
          penName: sample.penName,
          email,
          passwordHash,
          emailVerified: true,
          isActive: true,
        }),
      );
      console.log(`[seed] created sample user ${email}`);
    } else {
      console.log(`[seed] sample user ${email} already exists; left unchanged`);
    }

    for (const role of sample.roles) {
      const roleValue = role as UserRole;
      const hasRole = await roles.findOne({ where: { userId: user.id, role: roleValue } });
      if (!hasRole) {
        await roles.save(roles.create({ userId: user.id, role: roleValue }));
      }
    }
  }
}

async function insertMissing<T extends ObjectLiteral>(
  ds: DataSource,
  entity: EntityTarget<T>,
  key: keyof T & string,
  rows: Array<Partial<T>>,
): Promise<void> {
  const repo = ds.getRepository(entity);
  for (const row of rows) {
    const exists = await repo.findOne({ where: { [key]: row[key] } as never });
    if (!exists) {
      await repo.save(repo.create(row as T));
    }
  }
}

async function main(): Promise<void> {
  const cfg = new AppConfig();
  const ds = new DataSource(buildDataSourceOptions());
  await ds.initialize();
  try {
    await seedAdmin(ds, cfg);
    await seedSampleUsers(ds, cfg);
    await insertMissing(ds, Category, 'slug', seedData.categories);
    await insertMissing(ds, Language, 'code', seedData.languages);
    await insertMissing(ds, SubscriptionPlan, 'name', seedData.subscriptionPlans);
    await insertMissing(ds, ApplicationSetting, 'key', [{ key: 'ADS_ENABLED', value: String(cfg.ads.enabled) }]);
    await seedSampleStories(ds, cfg);
    console.log('[seed] done');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
