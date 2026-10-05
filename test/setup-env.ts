/**
 * Runs before every e2e test file. Points the app at a dedicated test
 * database (never the development one) and a throwaway upload folder.
 *
 * Override with TEST_DATABASE_URL; by default "<your db>_test" on the same
 * server as DATABASE_URL.
 */
import 'dotenv/config';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run e2e tests');
  }
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/^\//, '')}_test`;
  return url.toString();
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.DATABASE_LOGGING = 'false';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'tapaccess-e2e-'));
process.env.FRONTEND_URL = 'http://localhost:3001';
process.env.JWT_SECRET ??= 'e2e-test-secret-that-is-at-least-32-characters';
process.env.INTERNAL_API_KEY = 'e2e-internal-key-123456';
