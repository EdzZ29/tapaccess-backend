export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/**
 * Minimal object-storage contract. Add a driver (S3, R2, GCS...) by
 * implementing this interface and selecting it in `media.module.ts`.
 */
export interface StorageDriver {
  readonly name: string;
  /** Stores the bytes and returns the public URL for them. Throws StorageError. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  /** Reads a file back by its public URL, or returns null if it is not ours. */
  readByUrl(url: string): Promise<Buffer | null>;
  /** Optional self-check; returns a problem description or null. */
  check?(): Promise<string | null>;
}

export type StorageFailure =
  | 'auth'
  | 'bucket'
  | 'private'
  | 'too_large'
  | 'mime'
  | 'unreachable'
  | 'url'
  | 'unknown';

/**
 * A storage failure the admin can act on. The message says what is wrong
 * and where to fix it; it never contains keys or other secrets.
 */
export class StorageError extends Error {
  constructor(
    readonly reason: StorageFailure,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
