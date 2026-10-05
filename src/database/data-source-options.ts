import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from '../entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export interface DatabaseEnv {
  DATABASE_URL: string;
  /** Explicit on/off; undefined = decide from the host (see below). */
  DATABASE_SSL?: boolean;
  DATABASE_LOGGING?: boolean;
  /** Run pending migrations when the connection opens. */
  DATABASE_MIGRATE?: boolean;
}

/**
 * TLS unless the database is on this machine or on Render's private network
 * (internal hostnames like `dpg-abc123-a` have no dots). Hosted databases —
 * Supabase, Render's external URL, Neon — all require it.
 */
export function useSsl(url: string, explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  try {
    const { hostname, searchParams } = new URL(url);
    if (searchParams.get('sslmode') === 'disable') return false;
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return false;
    return hostname.includes('.');
  } catch {
    return false;
  }
}

/** Parses an optional boolean environment variable ("true"/"1"/"false"/unset). */
export const envFlag = (value: string | undefined): boolean | undefined =>
  value === undefined || value === ''
    ? undefined
    : ['true', '1', 'yes'].includes(value.toLowerCase());

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
    ssl: useSsl(env.DATABASE_URL, env.DATABASE_SSL)
      ? { rejectUnauthorized: false }
      : false,
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    // Applying migrations at startup means a fresh deploy creates its own
    // tables — no separate step, which Render's free plan can't run anyway.
    migrationsRun: env.DATABASE_MIGRATE ?? false,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: env.DATABASE_LOGGING ? ['query', 'error'] : ['error'],
    extra: { max: 10 },
  };
}
