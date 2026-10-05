import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from '../entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export interface DatabaseEnv {
  DATABASE_URL: string;
  DATABASE_SSL?: boolean;
  DATABASE_LOGGING?: boolean;
}

/**
 * Single source of truth for the connection, shared by the Nest app and the
 * TypeORM CLI (migrations). Schema changes only ever go through migrations;
 * `synchronize` is permanently off.
 */
export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    // gen_random_uuid() is built into PostgreSQL 13+, no extension needed.
    uuidExtension: 'pgcrypto',
    url: env.DATABASE_URL,
    // Managed Postgres (Supabase, Render) terminates TLS with certificates
    // that are not in Node's default CA bundle.
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: env.DATABASE_LOGGING ? ['query', 'error'] : ['error'],
    extra: { max: 10 },
  };
}
