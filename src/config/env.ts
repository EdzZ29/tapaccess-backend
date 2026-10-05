import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBool = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : typeof value === 'boolean'
      ? value
      : typeof value === 'string' &&
        ['true', '1', 'yes'].includes(value.toLowerCase());

const toInt = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

/**
 * Every environment variable the API reads. Validated once at boot so a
 * misconfigured deploy fails fast instead of at the first request.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(toInt)
  @IsInt()
  PORT = 4000;

  @IsString()
  DATABASE_URL!: string;

  /** Unset = automatic: on for hosted databases, off for localhost and Render's internal host. */
  @Transform(toBool)
  @IsOptional()
  @IsBoolean()
  DATABASE_SSL?: boolean;

  /** Apply pending migrations when the API starts. Unset = on in production. */
  @Transform(toBool)
  @IsOptional()
  @IsBoolean()
  DATABASE_MIGRATE?: boolean;

  @Transform(toBool)
  @IsBoolean()
  DATABASE_LOGGING = false;

  /** At least 32 characters. Generate with `openssl rand -base64 48`. */
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  /** Admin session length, e.g. 12h or 7d. */
  JWT_EXPIRES_IN = '12h';

  @IsString()
  COOKIE_NAME = 'tapaccess_session';

  @Transform(toBool)
  @IsOptional()
  @IsBoolean()
  COOKIE_SECURE?: boolean;

  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAMESITE: 'lax' | 'strict' | 'none' = 'lax';

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  /** Public URL of the Next.js frontend, used for CORS and origin checks. */
  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  /** Extra comma-separated origins allowed to call the API (e.g. preview deploys). */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** Number of reverse proxies in front of the API (Render = 1). */
  @Transform(toInt)
  @IsInt()
  @Min(0)
  TRUST_PROXY = 1;

  /** Shared secret the Next.js server sends to bypass per-IP rate limits. */
  @IsOptional()
  @IsString()
  @MinLength(16)
  INTERNAL_API_KEY?: string;

  /** Salt for the daily-rotating anonymous visitor hash. */
  @IsOptional()
  @IsString()
  @MinLength(16)
  ANALYTICS_SALT?: string;

  /** Raw visits and clicks older than this are deleted daily (about 13 months). */
  @Transform(toInt)
  @IsInt()
  @Min(30)
  @Max(3650)
  ANALYTICS_RETENTION_DAYS = 400;

  @IsIn(['local', 'supabase'])
  STORAGE_DRIVER: 'local' | 'supabase' = 'local';

  @IsString()
  UPLOAD_DIR = 'uploads';

  /**
   * Base URL returned for locally stored files. Relative by default so the
   * frontend can serve them through its `/uploads` rewrite.
   */
  @IsString()
  LOCAL_UPLOAD_BASE_URL = '/uploads';

  @IsOptional()
  @IsUrl()
  SUPABASE_URL?: string;

  @IsOptional()
  @IsString()
  SUPABASE_SERVICE_ROLE_KEY?: string;

  @IsString()
  SUPABASE_BUCKET = 'tapaccess-media';

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(25)
  MAX_UPLOAD_MB = 8;
}

export function validateEnv(raw: Record<string, unknown>) {
  // Accept the common singular spelling too.
  const config = { ...raw, CORS_ORIGINS: raw.CORS_ORIGINS ?? raw.CORS_ORIGIN };
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  if (
    env.STORAGE_DRIVER === 'supabase' &&
    (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new Error(
      'STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  if (env.COOKIE_SAMESITE === 'none' && env.COOKIE_SECURE === false) {
    throw new Error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }
  // Without the shared key the API can't tell visitors apart behind Vercel:
  // rate limits would hit everyone at once (Save contact failing at busy
  // venues) and visits from different people would be merged.
  if (env.NODE_ENV === NodeEnv.Production && !env.INTERNAL_API_KEY) {
    throw new Error(
      'INTERNAL_API_KEY is required in production (set the same value on the frontend)',
    );
  }
  return env;
}

export type AppConfig = EnvironmentVariables;
