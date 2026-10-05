# TapAccess API

NestJS 11 + TypeORM 1.1 + PostgreSQL. Serves the admin API, the public
profile API, visit/click tracking and the image pipeline for
[TapAccess](../README.md).

## Setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
npm run migration:run
npm run admin:create -- --email you@example.com --name "Your Name"
npm run seed:demo             # optional, refuses to run when NODE_ENV=production
npm run start:dev             # http://localhost:4000/api
```

`admin:create` reads the password from `ADMIN_PASSWORD`. When that's empty it
generates a strong password and prints it once. Passwords are never passed
as CLI arguments, so they stay out of shell history. Add `--reset-password`
to change an existing admin's password; this signs out all of that admin's
sessions.

## Scripts

| Script | Purpose |
|---|---|
| `start:dev` / `build` / `start:prod` | Develop / compile to `dist/` / run compiled |
| `migration:run` / `migration:revert` / `migration:show` | Apply, roll back or list migrations (ts-node) |
| `migration:generate -- src/database/migrations/Name` | Diff entities against the DB into a new migration |
| `migration:run:prod` | Apply migrations from compiled `dist/` (deploys) |
| `admin:create` / `admin:create:prod` | Create or reset the super admin |
| `seed:demo` | Sample cards with generated artwork and synthetic analytics (dev only) |
| `test` / `test:e2e` | Unit tests / HTTP tests against `<db>_test` (created automatically) |
| `lint` / `typecheck` / `format` | ESLint / tsc / Prettier |

## Environment

See [.env.example](.env.example) for every variable with comments. The API
validates its environment at boot and refuses to start when something is
missing or malformed.

| Variable | Required | Notes |
|---|:---:|---|
| `DATABASE_URL` | ✓ | Postgres connection string. Supabase: the session pooler URL + `DATABASE_SSL=true` |
| `JWT_SECRET` | ✓ | ≥ 32 random chars; signs admin sessions |
| `FRONTEND_URL` | ✓ | Exact origin of the Next.js site (CORS + CSRF origin check, vCard links) |
| `CORS_ORIGINS` | | Extra comma-separated origins (e.g. Vercel previews) |
| `INTERNAL_API_KEY` | in production | Shared with the frontend. Server-side renders skip rate limits; requests forwarded for a visitor are limited per the visitor IP the frontend vouches for |
| `ANALYTICS_SALT` | | Salt for the daily visitor hash (falls back to `JWT_SECRET`) |
| `TRUST_PROXY` | | Number of proxies in front of the API. Render = `1` |
| `STORAGE_DRIVER` | | `local` (dev) or `supabase` (production) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | with `supabase` | Bucket must be **public** |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | | Defaults: secure in production, `lax`, host-only |
| `MAX_UPLOAD_MB` | | Upload size cap (default 8) |

## API

Base path `/api`. JSON in and out. Every error has the same shape:

```json
{ "statusCode": 409, "error": "Conflict", "message": "This slug is already in use",
  "code": "SLUG_UNAVAILABLE", "details": [], "path": "/api/admin/cards", "timestamp": "…" }
```

### Auth: `/api/auth`
| Method | Path | |
|---|---|---|
| POST | `/login` | `{ email, password }` → sets the `tapaccess_session` cookie (HttpOnly, SameSite=Lax). 5/min and 20/hour per IP |
| POST | `/logout` | Clears the cookie |
| GET / PATCH | `/me` | Current admin / update display name |
| POST | `/change-password` | `{ currentPassword, newPassword }`; revokes every other session |

### Cards: `/api/admin/cards` (admin session required)
| Method | Path | |
|---|---|---|
| GET | `/` | `?search=&status=all\|active\|inactive\|archived&plan=&sort=createdAt\|updatedAt\|businessName\|slug\|cardCode\|status&order=&page=&pageSize=` → `{ data, meta }` |
| GET | `/stats` | Totals by status and package, all-time visits |
| GET | `/slug-availability?slug=&excludeId=` | Format, reserved-word and uniqueness check |
| POST | `/` | `{ businessName, slug, plan?, category?, cardCode?, notes? }` (card ID auto-numbers `TA-000001…`) |
| GET | `/:id` | Full card, including disabled content and internal notes |
| PATCH | `/:id` | `{ cardCode?, slug?, plan?, notes? }`. The slug is locked after first activation (`SLUG_LOCKED`) |
| PUT | `/:id/profile` | The editor's whole document: `{ profile, sections, buttons, socialLinks }`. Rows with ids update, new rows insert, missing rows delete, in one transaction |
| PATCH | `/:id/status` | `{ status: active\|inactive\|archived }` |
| POST | `/:id/duplicate` | `{ slug, businessName?, cardCode? }`. Copies the profile, not the analytics |
| DELETE | `/:id` | Archived cards only (`NOT_ARCHIVED` otherwise); also removes stored images |

### Media: `/api/admin/media`
| Method | Path | |
|---|---|---|
| POST | `/` | multipart `file`, `kind` (logo/cover/gallery/item/background/other), `cardId?` |
| GET | `/?cardId=&kind=&page=` | Image metadata (paginated) |
| DELETE | `/:id?force=` | Refuses with `MEDIA_IN_USE` while a profile still shows it, unless `force=true` |

Uploads are decoded and **re-encoded to WebP** with sharp. That verifies the
bytes are really an image (the MIME type isn't trusted), strips EXIF/GPS,
fixes orientation and resizes per kind. SVG is rejected, and inputs over
50 MP are refused (decompression bombs).

### Analytics: `/api/admin/analytics`
| Method | Path | |
|---|---|---|
| GET | `/overview?days=30&tz=Asia/Manila` | Totals, zero-filled daily series, top cards |
| GET | `/cards/:id?days=&tz=` | Totals, daily series, clicks by button, devices, referrers |

### Public: `/api/public/cards` (no auth)
| Method | Path | |
|---|---|---|
| GET | `/:slug` | Published profile, with the package applied. 404 `CARD_NOT_FOUND` / 403 `CARD_UNAVAILABLE` |
| GET | `/:slug/vcard` | `.vcf` download with an embedded JPEG logo |
| POST | `/:slug/visits` | `{ referrer? }` → `{ counted, reason? }` (30/min per IP) |
| POST | `/:slug/clicks` | `{ kind: button\|item, id }` or `{ kind: contact\|social, target }` (60/min per IP) |

`GET /api/health` reports database connectivity for Render's health check.

## Security summary

- **Sessions:** HS256 JWT in an HttpOnly, SameSite=Lax, Secure (in production)
  cookie. Each token carries `tokenVersion`, so a password change or reset
  revokes every session. Tokens are re-validated against the database on every
  request.
- **Passwords:** scrypt (N=2¹⁷, r=8, p=1) via Node's crypto, parameters stored
  in the hash. Unknown emails still run one scrypt, so response timing doesn't
  reveal whether an account exists.
- **Authorization:** global default-deny guard; only `@Public()` routes skip
  it. Rate limits run first, as a global throttler guard.
- **CSRF:** SameSite cookies plus an Origin allow-list on every state-changing
  request.
- **Input:** a global `ValidationPipe` with `whitelist` +
  `forbidNonWhitelisted`. Links must use an explicit allowed scheme
  (`https`/`http`/`tel`/`mailto`/`sms`; never `javascript:` or `data:`), text is
  stripped of tags and control characters, and colours, times, enums and lengths
  are validated.
- **Output:** public responses are allow-listed field by field. `helmet`
  headers are set; DB errors map to generic messages; stack traces are only
  logged.

## Layout

```
src/
  app.module.ts, app.setup.ts, main.ts   bootstrap, global guards/filters/middleware
  config/env.ts                          validated environment
  database/                              data source, naming strategy, migrations
  entities/                              TypeORM entities + enums + JSON shapes
  common/                                decorators, validators, filters, plans, utils
  modules/
    auth/       login, sessions, guard, scrypt
    cards/      CRUD, profile sync, duplicate, status
    media/      upload pipeline + storage drivers (local, supabase)
    analytics/  tracking + reporting queries
    public/     public profile mapper, vCard
    health/
  cli/          create-admin, seed-demo
test/           e2e suite
```
