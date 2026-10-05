export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/**
 * Minimal object-storage contract. Add a driver (S3, R2, GCS...) by
 * implementing this interface and selecting it in `media.module.ts`.
 */
export interface StorageDriver {
  readonly name: string;
  /** Stores the bytes and returns the public URL for them. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  /** Reads a file back by its public URL, or returns null if it is not ours. */
  readByUrl(url: string): Promise<Buffer | null>;
  /** Optional startup self-check; returns a problem description or null. */
  check?(): Promise<string | null>;
}
