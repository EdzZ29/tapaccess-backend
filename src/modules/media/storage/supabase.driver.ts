import type { StorageDriver } from './storage.driver';

/**
 * Supabase Storage over its REST API (no SDK needed). The bucket must be
 * public so profile pages can load images without signed URLs. The service
 * role key never leaves the API server.
 */
export class SupabaseStorageDriver implements StorageDriver {
  readonly name = 'supabase';
  private readonly base: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {
    this.base = supabaseUrl.replace(/\/$/, '');
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const res = await fetch(
      `${this.base}/storage/v1/object/${this.bucket}/${key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          apikey: this.serviceKey,
          'Content-Type': contentType,
          'Cache-Control': 'max-age=31536000, immutable',
          'x-upsert': 'false',
        },
        body: new Uint8Array(body),
      },
    );
    if (!res.ok)
      throw new Error(
        `Supabase upload failed (${res.status}): ${await res.text()}`,
      );
    return this.publicUrl(key);
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(`${this.base}/storage/v1/object/${this.bucket}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [key] }),
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

  private publicUrl(key: string): string {
    return `${this.base}/storage/v1/object/public/${this.bucket}/${key}`;
  }
}
