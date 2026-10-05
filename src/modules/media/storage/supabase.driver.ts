import type { StorageDriver } from './storage.driver';

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
 */
export class SupabaseStorageDriver implements StorageDriver {
  readonly name = 'supabase';
  private readonly base: string;
  private readonly auth: Record<string, string>;

  constructor(
    supabaseUrl: string,
    serviceKey: string,
    private readonly bucket: string,
  ) {
    this.base = supabaseUrl.replace(/\/$/, '');
    const key = serviceKey.trim();
    this.auth = key.startsWith('sb_')
      ? { apikey: key }
      : { apikey: key, Authorization: `Bearer ${key}` };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const res = await fetch(
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
    if (!res.ok) {
      throw new Error(
        `Supabase upload failed (${res.status}): ${await res.text()}`,
      );
    }
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
   * Startup self-check: is the key accepted, does the bucket exist, and is it
   * public? Returns a human-readable problem, or null when all is well.
   */
  async check(): Promise<string | null> {
    try {
      const res = await fetch(`${this.base}/storage/v1/bucket/${this.bucket}`, {
        headers: this.auth,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401 || res.status === 403) {
        return "Supabase rejected SUPABASE_SERVICE_ROLE_KEY. Use the project's secret key (sb_secret_…) or legacy service_role key — not the publishable/anon key.";
      }
      if (res.status === 404 || res.status === 400) {
        return `Supabase bucket "${this.bucket}" not found. Create it in Storage → New bucket (Public bucket: on), or fix SUPABASE_BUCKET.`;
      }
      if (!res.ok) return `Supabase storage check failed (${res.status}).`;
      const bucket = (await res.json()) as { public?: boolean };
      if (!bucket.public) {
        return `Supabase bucket "${this.bucket}" is private, so card images won't load. Edit the bucket and turn on "Public bucket".`;
      }
      return null;
    } catch (err) {
      return `Could not reach Supabase at ${this.base} (${(err as Error).message}). Check SUPABASE_URL.`;
    }
  }

  private publicUrl(key: string): string {
    return `${this.base}/storage/v1/object/public/${this.bucket}/${key}`;
  }
}
