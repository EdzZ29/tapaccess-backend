import { Logger } from '@nestjs/common';
import { StorageError } from './storage.driver';
import { normalizeSupabaseUrl, SupabaseStorageDriver } from './supabase.driver';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('SupabaseStorageDriver', () => {
  const driver = new SupabaseStorageDriver(
    'https://proj.supabase.co/',
    'sb_secret_test',
    'tapaccess-media',
  );
  const realFetch = global.fetch;
  let calls: { url: string; method: string; headers: Headers }[];

  const mockFetch = (handler: Handler) => {
    calls = [];
    global.fetch = jest.fn((input: string, init?: RequestInit) => {
      const url = input;
      calls.push({
        url,
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
      });
      return Promise.resolve(handler(url, init ?? {}));
    }) as typeof fetch;
  };

  const putError = async () => {
    try {
      await driver.put('cards/x/logo/a.webp', Buffer.from('img'), 'image/webp');
    } catch (err) {
      return err as StorageError;
    }
    throw new Error('expected put to fail');
  };

  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation());
  beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation());
  afterAll(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('uploads and returns the public URL; secret keys go only in apikey', async () => {
    mockFetch(() => json(200, { Key: 'ok' }));
    await expect(
      driver.put('cards/x/logo/a.webp', Buffer.from('img'), 'image/webp'),
    ).resolves.toBe(
      'https://proj.supabase.co/storage/v1/object/public/tapaccess-media/cards/x/logo/a.webp',
    );
    expect(calls[0].headers.get('apikey')).toBe('sb_secret_test');
    expect(calls[0].headers.get('authorization')).toBeNull();
  });

  it('creates a missing bucket (public) and retries the upload', async () => {
    let uploads = 0;
    mockFetch((url, init) => {
      if (url.endsWith('/storage/v1/bucket')) {
        expect(JSON.parse(init.body as string)).toMatchObject({
          id: 'tapaccess-media',
          public: true,
        });
        return json(200, { name: 'tapaccess-media' });
      }
      uploads++;
      return uploads === 1
        ? json(400, {
            statusCode: '404',
            error: 'Bucket not found',
            message: 'Bucket not found',
          })
        : json(200, { Key: 'ok' });
    });
    await expect(
      driver.put('k.webp', Buffer.from('img'), 'image/webp'),
    ).resolves.toContain('/public/tapaccess-media/k.webp');
    expect(uploads).toBe(2);
  });

  it('explains a missing bucket it is not allowed to create', async () => {
    mockFetch((url) =>
      url.endsWith('/storage/v1/bucket')
        ? json(403, { message: 'new row violates row-level security policy' })
        : json(404, { error: 'Bucket not found', message: 'Bucket not found' }),
    );
    const err = await putError();
    expect(err.reason).toBe('bucket');
    expect(err.message).toMatch(
      /create a public bucket named "tapaccess-media"/,
    );
  });

  it.each([
    [
      'a rejected key',
      json(403, { error: 'Unauthorized', message: 'invalid signature' }),
      'auth',
      /SUPABASE_SERVICE_ROLE_KEY/,
    ],
    [
      'a file over the bucket size limit',
      json(413, {
        error: 'Payload too large',
        message: 'The object exceeded the maximum allowed size',
      }),
      'too_large',
      /file size limit/,
    ],
    [
      'a MIME type restriction',
      json(415, {
        error: 'invalid_mime_type',
        message: 'mime type image/webp is not supported',
      }),
      'mime',
      /image\/webp/,
    ],
    [
      'anything else',
      json(500, { message: 'internal' }),
      'unknown',
      /refused the upload \(500: internal\)/,
    ],
  ])('classifies %s', async (_name, response, reason, message) => {
    mockFetch(() => response.clone());
    const err = await putError();
    expect(err).toBeInstanceOf(StorageError);
    expect(err.reason).toBe(reason);
    expect(err.message).toMatch(message);
    expect(err.message).not.toContain('sb_secret_test');
  });

  it('explains the gateway "Invalid path" answer as a SUPABASE_URL problem', async () => {
    mockFetch(() =>
      json(404, { message: 'Invalid path specified in request URL' }),
    );
    const err = await putError();
    expect(err.reason).toBe('url');
    expect(err.message).toMatch(/SUPABASE_URL/);
    await expect(driver.check()).resolves.toMatch(/SUPABASE_URL/);
  });

  it.each([
    ['https://abcdefghijklmnopqrst.supabase.co', null],
    ['https://abcdefghijklmnopqrst.supabase.co/', null],
    ['https://abcdefghijklmnopqrst.supabase.co/rest/v1/', 'changed'],
    ['https://abcdefghijklmnopqrst.supabase.co/storage/v1/s3', 'changed'],
    [
      'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/settings/api',
      'changed',
    ],
    ['https://db.abcdefghijklmnopqrst.supabase.co', 'changed'],
    ['  https://abcdefghijklmnopqrst.supabase.co  ', null],
  ])('normalizes SUPABASE_URL %s', (raw, note) => {
    const result = normalizeSupabaseUrl(raw);
    expect(result.base).toBe('https://abcdefghijklmnopqrst.supabase.co');
    expect(result.note === null ? null : 'changed').toBe(note);
  });

  it('uses only the project root and a clean bucket name in requests', async () => {
    const messy = new SupabaseStorageDriver(
      'https://abcdefghijklmnopqrst.supabase.co/rest/v1/',
      'sb_secret_test',
      ' /tapaccess-media/ ',
    );
    mockFetch(() => json(200, {}));
    await expect(
      messy.put('a.webp', Buffer.from('x'), 'image/webp'),
    ).resolves.toBe(
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/tapaccess-media/a.webp',
    );
    expect(calls[0].url).toBe(
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/tapaccess-media/a.webp',
    );
  });

  it('reports an unreachable Supabase without crashing', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new TypeError('fetch failed')),
    ) as typeof fetch;
    const err = await putError();
    expect(err.reason).toBe('unreachable');
    expect(err.message).toMatch(/SUPABASE_URL/);
  });

  it('check(): creates a missing bucket and flags a private one', async () => {
    mockFetch((url) =>
      url.endsWith('/storage/v1/bucket')
        ? json(200, {})
        : json(400, { statusCode: '404', error: 'Bucket not found' }),
    );
    await expect(driver.check()).resolves.toBeNull();

    mockFetch(() => json(200, { id: 'tapaccess-media', public: false }));
    await expect(driver.check()).resolves.toMatch(/Public bucket/);
  });
});
