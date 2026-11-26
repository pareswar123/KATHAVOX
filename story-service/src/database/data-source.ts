import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.options';

/** Used only by the TypeORM CLI (migration:generate / migration:run / migration:revert). */
export default new DataSource(buildDataSourceOptions());
