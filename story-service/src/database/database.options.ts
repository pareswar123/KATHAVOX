import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { env } from '../config/env';
import { ENTITIES } from './entities';

/**
 * PostgreSQL settings, read from the environment.
 * Shared by the Nest app (TypeOrmModule) and the TypeORM CLI (data-source.ts).
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.nonEmpty('DATABASE_HOST'),
    port: env.number('DATABASE_PORT'),
    database: env.nonEmpty('DATABASE_NAME'),
    username: env.nonEmpty('DATABASE_USERNAME'),
    password: env.string('DATABASE_PASSWORD'),
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    migrationsTableName: env.nonEmpty('DATABASE_MIGRATIONS_TABLE'),
    synchronize: false,
    migrationsRun: false,
    logging: env.bool('DATABASE_LOGGING') ? ['error', 'warn'] : false,
  };
}
