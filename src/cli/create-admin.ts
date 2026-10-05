/**
 * Creates the super admin, or resets an existing admin's password.
 *
 *   npm run admin:create -- --email you@example.com --name "Your Name"
 *   npm run admin:create -- --email you@example.com --reset-password
 *
 * The password is read from ADMIN_PASSWORD; if it is not set, a strong one
 * is generated and printed once. Never passed as a CLI argument, so it does
 * not end up in shell history.
 */
import 'dotenv/config';
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  buildDataSourceOptions,
  envFlag,
} from '../database/data-source-options';
import { Admin, AdminRole } from '../entities';
import { hashPassword, PASSWORD_MIN_LENGTH } from '../modules/auth/password';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '')
    .trim()
    .toLowerCase();
  const name = (arg('name') ?? process.env.ADMIN_NAME ?? 'Super Admin').trim();
  const reset = process.argv.includes('--reset-password');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Provide a valid email with --email or ADMIN_EMAIL');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(18).toString('base64url');
    generated = true;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }

  const db = await new DataSource(
    buildDataSourceOptions({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_SSL: envFlag(process.env.DATABASE_SSL),
      // Creates the tables first if this runs before the API's first start.
      DATABASE_MIGRATE: true,
    }),
  ).initialize();

  try {
    const repo = db.getRepository(Admin);
    const existing = await repo.findOneBy({ email });

    if (existing && !reset) {
      console.log(
        `An admin with email ${email} already exists. Use --reset-password to set a new password.`,
      );
      return;
    }

    if (existing) {
      existing.passwordHash = await hashPassword(password);
      existing.tokenVersion += 1; // sign out every existing session
      await repo.save(existing);
      console.log(
        `Password reset for ${email}. All existing sessions were signed out.`,
      );
    } else {
      await repo.save(
        repo.create({
          email,
          name,
          role: AdminRole.SuperAdmin,
          passwordHash: await hashPassword(password),
        }),
      );
      console.log(`Super admin created: ${email}`);
    }

    if (generated) {
      console.log(
        '\n  Generated password (shown once, store it in a password manager):\n',
      );
      console.log(`    ${password}\n`);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err: Error) => {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
});
