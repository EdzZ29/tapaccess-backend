import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { StorageError, type StorageDriver } from './storage.driver';

/**
 * Writes files to disk; `main.ts` serves them under `/uploads`. Intended for
 * local development only — Render's filesystem is ephemeral.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;

  constructor(
    uploadDir: string,
    private readonly baseUrl: string,
  ) {
    this.root = resolve(uploadDir);
  }

  async put(key: string, body: Buffer): Promise<string> {
    const path = this.pathFor(key);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'error';
      throw new StorageError(
        code === 'ENOSPC' ? 'too_large' : 'unknown',
        code === 'ENOSPC'
          ? 'The server is out of disk space for images.'
          : `The server couldn't save the image to UPLOAD_DIR (${code}). Check that the folder exists and is writable.`,
      );
    }
    return `${this.baseUrl.replace(/\/$/, '')}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }

  async readByUrl(url: string): Promise<Buffer | null> {
    const prefix = `${this.baseUrl.replace(/\/$/, '')}/`;
    if (!url.startsWith(prefix)) return null;
    try {
      return await readFile(this.pathFor(url.slice(prefix.length)));
    } catch {
      return null;
    }
  }

  /** Resolves a key inside the upload root, refusing anything that escapes it. */
  private pathFor(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep))
      throw new Error('Invalid storage key');
    return path;
  }
}
