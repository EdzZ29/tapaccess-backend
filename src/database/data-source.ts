import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions, envFlag } from './data-source-options';

/** Entry point for the TypeORM CLI (`npm run migration:*`). */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

export default new DataSource(
  buildDataSourceOptions({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL: envFlag(process.env.DATABASE_SSL),
  }),
);
