import { Logger } from '@nestjs/common';
import { StorageError, type StorageDriver } from './storage.driver';

interface SupabaseError {
  statusCode?: string | number;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Supabase Storage over its REST API (no SDK needed). The bucket must be
 * public so profile pages can load images without signed URLs. The server
 * key never leaves the API.
 *
 * Works with both Supabase key formats:
 * - new secret keys (`sb_secret_…`): sent only as `apikey`; Supabase's gateway
 *   turns them into a short-lived service-role token. They are not JWTs, so
 *   they must not be sent as a Bearer token.
 * - legacy `service_role` JWTs (`eyJ…`): sent as `apikey` and Bearer token.
 *
 * A missing bucket is created (public) on startup or on the first upload, so
 * a fresh Supabase project works without a manual step.
 */
export class SupabaseStorageDriver implements StorageDriver {
  readonly name = 'supabase';
  private readonly logger = new Logger('SupabaseStorage');
  private readonly base: string;
  private readonly auth: Record<string, string>;

  private readonly bucket: string;

  constructor(supabaseUrl: string, serviceKey: string, bucket: string) {
    const { base, note } = normalizeSupabaseUrl(supabaseUrl);
    this.base = base;
    if (note) this.logger.warn(note);
    this.bucket = bucket.trim().replace(/^\/+|\/+$/g, '');
    this.logger.log(
      `Storage: ${this.base}/storage/v1, bucket "${this.bucket}"`,
    );
    const key = serviceKey.trim();
    this.auth = key.startsWith('sb_')
      ? { apikey: key }
      : { apikey: key, Authorization: `Bearer ${key}` };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    let failure = await this.upload(key, body, contentType);
    if (failure?.reason === 'bucket') {
      // Fresh project: create the bucket once and try again.
      const created = await this.ensureBucket();
      if (created !== true) throw this.bucketError(created);
      failure = await this.upload(key, body, contentType);
    }
    if (failure) throw failure;
    return this.publicUrl(key);
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(`${this.base}/storage/v1/object/${this.bucket}`, {
      method: 'DELETE',
      headers: { ...this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [key] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 404)
      throw new Error(`Supabase delete failed (${res.status})`);
  }

  async readByUrl(url: string): Promise<Buffer | null> {
    // Only fetch from our own bucket, so this can never be used for SSRF.
    if (!url.startsWith(this.publicUrl(''))) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Is the key accepted, does the bucket exist (created if not), and is it
   * public? Returns a human-readable problem, or null when all is well.
   */
  async check(): Promise<string | null> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/storage/v1/bucket/${this.bucket}`, {
        headers: this.auth,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      return this.unreachable(err).message;
    }
    const error = res.ok ? null : await readError(res);
    if (isInvalidPath(error)) return this.urlMessage();
    if (res.status === 401 || res.status === 403 || isAuthError(error)) {
      return AUTH_MESSAGE;
    }
    if (!res.ok && isMissingBucket(res.status, error)) {
      const created = await this.ensureBucket();
      return created === true ? null : this.bucketError(created).message;
    }
    if (!res.ok) {
      return `Image storage check failed (${res.status}${error?.message ? `: ${error.message}` : ''}).`;
    }
    const bucket = (await res.json()) as { public?: boolean };
    if (!bucket.public) return this.privateMessage();
    return null;
  }

  /** Uploads once; returns null on success or the classified failure. */
  private async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StorageError | null> {
    let res: Response;
    try {
      res = await fetch(
        `${this.base}/storage/v1/object/${this.bucket}/${key}`,
        {
          method: 'POST',
          headers: {
            ...this.auth,
            'Content-Type': contentType,
            'Cache-Control': 'max-age=31536000, immutable',
            'x-upsert': 'false',
          },
          body: new Uint8Array(body),
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (err) {
      return this.unreachable(err);
    }
    if (res.ok) return null;

    const error = await readError(res);
    const detail = `${error?.error ?? ''} ${error?.message ?? ''}`;
    this.logger.warn(
      `Upload to "${this.bucket}" failed (${res.status}): ${detail.trim()}`,
    );

    if (isInvalidPath(error)) {
      return new StorageError('url', this.urlMessage());
    }
    if (isMissingBucket(res.status, error)) {
      return new StorageError('bucket', 'Bucket not found');
    }
    if (res.status === 401 || res.status === 403 || isAuthError(error)) {
      return new StorageError('auth', AUTH_MESSAGE);
    }
    if (
      res.status === 413 ||
      /maximum allowed size|payload too large|entitytoolarge|too large/i.test(
        detail,
      )
    ) {
      return new StorageError(
        'too_large',
        `The image is bigger than the storage bucket's file size limit. In Supabase → Storage → "${this.bucket}" → Edit bucket, raise or remove the upload file size limit.`,
      );
    }
    if (res.status === 415 || /mime/i.test(detail)) {
      return new StorageError(
        'mime',
        `The storage bucket doesn't accept WebP images. In Supabase → Storage → "${this.bucket}" → Edit bucket, add image/webp to "Allowed MIME types" (or turn the restriction off).`,
      );
    }
    return new StorageError(
      'unknown',
      `Image storage refused the upload (${res.status}${error?.message ? `: ${error.message}` : ''}). Please try again; if it keeps happening, check the Supabase project status.`,
    );
  }

  /** Creates the bucket as public. Returns true, or why it couldn't. */
  private async ensureBucket(): Promise<true | string> {
    try {
      const res = await fetch(`${this.base}/storage/v1/bucket`, {
        method: 'POST',
        headers: { ...this.auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.bucket,
          name: this.bucket,
          public: true,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        this.logger.log(`Created public storage bucket "${this.bucket}"`);
        return true;
      }
      const error = await readError(res);
      if (res.status === 409 || /already exists/i.test(error?.message ?? ''))
        return true;
      if (res.status === 401 || res.status === 403 || isAuthError(error))
        return 'the server key is not allowed to create buckets';
      return `${res.status}${error?.message ? `: ${error.message}` : ''}`;
    } catch (err) {
      return (err as Error).message;
    }
  }

  private bucketError(why: string): StorageError {
    return new StorageError(
      'bucket',
      `The image storage bucket "${this.bucket}" doesn't exist and couldn't be created automatically (${why}). In Supabase → Storage, create a public bucket named "${this.bucket}", or set SUPABASE_BUCKET on Render to your bucket's name.`,
    );
  }

  private urlMessage(): string {
    return `Supabase didn't recognise the storage address ${this.base}/storage/v1. On Render, set SUPABASE_URL to your project URL exactly as shown in Supabase → Project Settings → Data API (https://<project-id>.supabase.co, nothing after it), and SUPABASE_BUCKET to the bucket name only.`;
  }

  private privateMessage(): string {
    return `The storage bucket "${this.bucket}" is private, so uploaded images can't be shown. In Supabase → Storage → "${this.bucket}" → Edit bucket, turn on "Public bucket".`;
  }

  private unreachable(err: unknown): StorageError {
    const timeout = (err as Error)?.name === 'TimeoutError';
    return new StorageError(
      'unreachable',
      timeout
        ? 'Image storage (Supabase) took too long to answer. Please try again.'
        : `Couldn't reach image storage at ${this.base}. Check SUPABASE_URL on Render, or try again in a moment.`,
    );
  }

  private publicUrl(key: string): string {
    return `${this.base}/storage/v1/object/public/${this.bucket}/${key}`;
  }
}

/**
 * The storage API lives at the project root (https://<ref>.supabase.co), but
 * it's easy to paste a longer address: the "RESTful endpoint" (…/rest/v1),
 * the S3 endpoint, a dashboard link or the database host. Reduce any of
 * those to the project root, and say so in the log.
 */
export function normalizeSupabaseUrl(raw: string): {
  base: string;
  note: string | null;
} {
  const input = raw.trim();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { base: input.replace(/\/+$/, ''), note: null };
  }
  let host = url.host;
  // Dashboard link: https://supabase.com/dashboard/project/<ref>/…
  const dashboard = /\/project\/([a-z0-9]{20})(?:\/|$)/.exec(url.pathname);
  if (/(^|\.)supabase\.com$/.test(url.hostname) && dashboard) {
    host = `${dashboard[1]}.supabase.co`;
  }
  // Database host: db.<ref>.supabase.co
  host = host.replace(/^db\.([a-z0-9]{20}\.supabase\.co)$/, '$1');
  const base = `${url.protocol}//${host}`;
  const changed = base !== input.replace(/\/+$/, '');
  return {
    base,
    note: changed
      ? `SUPABASE_URL should be just the project address; using ${base} (you set "${input}").`
      : null,
  };
}

/** The Supabase gateway's answer when a request path doesn't exist. */
const isInvalidPath = (error: SupabaseError | null) =>
  /invalid path specified/i.test(
    `${error?.message ?? ''} ${error?.error ?? ''}`,
  );

const AUTH_MESSAGE =
  "Image storage rejected the server's key. On Render, set SUPABASE_SERVICE_ROLE_KEY to the Supabase project's secret key (sb_secret_…) or legacy service_role key — not the publishable/anon key.";

async function readError(res: Response): Promise<SupabaseError | null> {
  try {
    return (await res.json()) as SupabaseError;
  } catch {
    return null;
  }
}

/** Supabase reports a missing bucket as 404, or as 400 with "Bucket not found". */
function isMissingBucket(status: number, error: SupabaseError | null) {
  return (
    error?.code === 'NoSuchBucket' ||
    /bucket not found/i.test(`${error?.error ?? ''} ${error?.message ?? ''}`) ||
    (status === 404 && !error)
  );
}

function isAuthError(error: SupabaseError | null) {
  return /unauthorized|invalid (jwt|signature|api key)|row-level security|jws/i.test(
    `${error?.error ?? ''} ${error?.message ?? ''}`,
  );
}
