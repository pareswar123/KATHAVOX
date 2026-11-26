# Database

- PostgreSQL 14+; database name from `DATABASE_NAME` (default `story_platform`).
- Schema is defined by TypeORM entities in `story-service/src/database/entities/` and applied with migrations in `story-service/src/database/migrations/`.
- Seed data is created by `npm run seed` in `story-service` (idempotent).
- Do not edit the schema by hand. Change the entities and run `npm run migration:generate`.
