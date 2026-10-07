import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Client } from 'pg';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { buildDataSourceOptions } from '../src/database/data-source-options';
import { Admin } from '../src/entities';
import { hashPassword } from '../src/modules/auth/password';

const ADMIN = {
  email: 'e2e-admin@tapaccess.test',
  password: 'correct horse battery',
};
const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Creates the test database if needed and brings it to the latest migration. */
async function prepareDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [name],
  );
  if (exists.rowCount === 0)
    await client.query(`CREATE DATABASE "${name.replace(/"/g, '')}"`);
  await client.end();

  const ds = await new DataSource(
    buildDataSourceOptions({ DATABASE_URL: url.toString() }),
  ).initialize();
  await ds.runMigrations();
  await ds.query(
    'TRUNCATE button_clicks, card_visits, media_assets, section_items, card_sections, card_buttons, social_links, card_profiles, nfc_cards, admins RESTART IDENTITY CASCADE',
  );
  await ds.getRepository(Admin).save({
    email: ADMIN.email,
    name: 'E2E Admin',
    passwordHash: await hashPassword(ADMIN.password),
  });
  await ds.destroy();
}

describe('TapAccess API (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let cookie: string;

  beforeAll(async () => {
    await prepareDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(nest);
    await nest.init();
    app = nest;
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app
      ?.get<DataSource>(getDataSourceToken())
      .destroy()
      .catch(() => undefined);
    await app?.close();
  });

  const authed = (req: request.Test) => req.set('Cookie', cookie);

  describe('auth', () => {
    it('reports health without auth', () =>
      request(http)
        .get('/api/health')
        .expect(200, { status: 'ok', database: 'up' }));

    it('rejects admin routes without a session', () =>
      request(http).get('/api/admin/cards').expect(401));

    it('rejects a wrong password with a generic message', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ email: ADMIN.email, password: 'nope' })
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('signs in and sets an HttpOnly session cookie', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send(ADMIN)
        .expect(200);
      const setCookie = ([] as string[]).concat(
        res.headers['set-cookie'] ?? [],
      );
      const session = setCookie.find((c) => c.startsWith('tapaccess_session='));
      expect(session).toMatch(/HttpOnly/i);
      expect(session).toMatch(/SameSite=Lax/i);
      expect(res.body.admin).not.toHaveProperty('passwordHash');
      cookie = session!.split(';')[0];
    });

    it('rejects a forged token', () =>
      request(http)
        .get('/api/auth/me')
        .set('Cookie', 'tapaccess_session=eyJhbGciOiJIUzI1NiJ9.e30.x')
        .expect(401));
  });

  describe('cards', () => {
    let cardId: string;

    it('creates a card with sanitised input and an auto card ID', async () => {
      const res = await authed(request(http).post('/api/admin/cards'))
        .send({
          businessName: 'Test <b>Shop</b>',
          slug: 'E2E-Shop',
          notes: 'internal only',
        })
        .expect(201);
      cardId = res.body.id;
      expect(res.body).toMatchObject({
        businessName: 'Test Shop',
        slug: 'e2e-shop',
        status: 'inactive',
        plan: 'business',
      });
      expect(res.body.cardCode).toMatch(/^TA-\d{6}$/);
    });

    it('rejects reserved and duplicate slugs and unknown fields', async () => {
      await authed(request(http).post('/api/admin/cards'))
        .send({ businessName: 'X', slug: 'admin' })
        .expect(400);
      await authed(request(http).post('/api/admin/cards'))
        .send({ businessName: 'X', slug: 'e2e-shop' })
        .expect(409);
      await authed(request(http).post('/api/admin/cards'))
        .send({ businessName: 'X', slug: 'xyz-1', status: 'active' })
        .expect(400);
    });

    it('rejects javascript: links in buttons', async () => {
      const { body: card } = await authed(
        request(http).get(`/api/admin/cards/${cardId}`),
      ).expect(200);
      const res = await authed(
        request(http).put(`/api/admin/cards/${cardId}/profile`),
      )
        .send({
          profile: card.profile,
          sections: [],
          buttons: [
            {
              label: 'Bad',
              url: 'javascript:alert(1)',
              icon: 'link',
              enabled: true,
              highlighted: false,
            },
          ],
          socialLinks: [],
        })
        .expect(400);
      expect(res.body.message).toMatch(/buttons\.0\.url/);
    });

    it('saves a profile and keeps button ids stable across saves', async () => {
      const { body: card } = await authed(
        request(http).get(`/api/admin/cards/${cardId}`),
      ).expect(200);
      const payload = {
        profile: {
          ...card.profile,
          website: 'example.com',
          logoUrl: '/uploads/cards/x/logo/a.webp',
        },
        sections: card.sections.map(
          (s: { type: string; title: string | null; items: unknown[] }) => ({
            type: s.type,
            title: s.title,
            enabled: true,
            items:
              s.type === 'promotions'
                ? [
                    {
                      title: 'Expired',
                      endsAt: '2020-01-01T00:00:00Z',
                      enabled: true,
                    },
                    { title: 'Live', enabled: true },
                  ]
                : s.items,
          }),
        ),
        buttons: [
          {
            label: 'Book',
            url: 'example.com/book',
            icon: 'calendar',
            enabled: true,
            highlighted: true,
          },
          {
            label: 'Call',
            url: 'tel:+15550100',
            icon: 'phone',
            enabled: true,
            highlighted: false,
          },
        ],
        socialLinks: [
          {
            platform: 'instagram',
            url: 'https://instagram.com/e2e',
            enabled: true,
          },
          {
            platform: 'facebook',
            url: 'https://facebook.com/e2e',
            enabled: true,
          },
          {
            platform: 'youtube',
            url: 'https://youtube.com/@e2e',
            enabled: true,
          },
        ],
      };
      const first = await authed(
        request(http).put(`/api/admin/cards/${cardId}/profile`),
      )
        .send(payload)
        .expect(200);
      expect(first.body.profile.website).toBe('https://example.com');
      const ids = first.body.buttons.map((b: { id: string }) => b.id);

      const again = await authed(
        request(http).put(`/api/admin/cards/${cardId}/profile`),
      )
        .send({
          ...payload,
          buttons: [...first.body.buttons].reverse(),
          sections: payload.sections,
        })
        .expect(200);
      expect(again.body.buttons.map((b: { id: string }) => b.id)).toEqual(
        [...ids].reverse(),
      );
    });

    it('keeps inactive cards off the public page', async () => {
      const res = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(403);
      expect(res.body.code).toBe('CARD_UNAVAILABLE');
      await request(http).get('/api/public/cards/never-issued').expect(404);
    });

    it('lets an active card change its slug; the old one keeps forwarding', async () => {
      await authed(request(http).patch(`/api/admin/cards/${cardId}/status`))
        .send({ status: 'active' })
        .expect(200);
      const renamed = await authed(
        request(http).patch(`/api/admin/cards/${cardId}`),
      )
        .send({ slug: 'e2e-renamed' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        slug: 'e2e-renamed',
        slugForwards: true,
        oldSlugs: ['e2e-shop'],
      });

      // Old NFC tags and links still reach the card…
      const moved = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      expect(moved.body).toEqual({ movedTo: 'e2e-renamed' });
      const vcard = await request(http)
        .get('/api/public/cards/e2e-shop/vcard')
        .expect(200);
      expect(vcard.text).toContain('/c/e2e-renamed');
      // …and no other card can take the old address.
      const check = await authed(
        request(http)
          .get('/api/admin/cards/slug-availability')
          .query({ slug: 'e2e-shop' }),
      ).expect(200);
      expect(check.body.available).toBe(false);
      await authed(request(http).post('/api/admin/cards'))
        .send({ businessName: 'Squatter', slug: 'e2e-shop' })
        .expect(409);

      // The card itself can take its old address back.
      const back = await authed(
        request(http).patch(`/api/admin/cards/${cardId}`),
      )
        .send({ slug: 'e2e-shop' })
        .expect(200);
      expect(back.body.oldSlugs).toEqual(['e2e-renamed']);
      const forward = await request(http)
        .get('/api/public/cards/e2e-renamed')
        .expect(200);
      expect(forward.body).toEqual({ movedTo: 'e2e-shop' });
    });

    it('serves only public data, without notes, internal IDs or expired items', async () => {
      const res = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/internal only|cardCode|TA-\d{6}|notes|status/);
      const promos = res.body.sections.find(
        (s: { type: string }) => s.type === 'promotions',
      );
      expect(promos.items.map((i: { title: string }) => i.title)).toEqual([
        'Live',
      ]);
    });

    it('applies the Starter package to the public page without deleting content', async () => {
      await authed(request(http).patch(`/api/admin/cards/${cardId}`))
        .send({ plan: 'starter' })
        .expect(200);
      const starter = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      expect(starter.body.logoUrl).toBeNull();
      // Starter: Facebook/Instagram/TikTok/X only (YouTube hidden);
      // contact + social shown automatically.
      expect(
        starter.body.socialLinks.map((l: { platform: string }) => l.platform),
      ).toEqual(['instagram', 'facebook']);
      expect(
        starter.body.sections.map((s: { type: string }) => s.type).sort(),
      ).toEqual(['about', 'actions', 'contact', 'social']);
      // Starter keeps its full theme; only photos are withheld.
      expect(starter.body.theme.layout).toBe('classic');
      expect(starter.body.coverUrl).toBeNull();

      await authed(request(http).patch(`/api/admin/cards/${cardId}`))
        .send({ plan: 'business' })
        .expect(200);
      const business = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      expect(business.body.logoUrl).toBe('/uploads/cards/x/logo/a.webp');
      expect(business.body.socialLinks).toHaveLength(3);
    });

    it('blocks state-changing requests from foreign origins', () =>
      authed(request(http).patch(`/api/admin/cards/${cardId}/status`))
        .set('Origin', 'https://evil.example')
        .send({ status: 'inactive' })
        .expect(403));

    it('only deletes archived cards', async () => {
      const { body } = await authed(request(http).post('/api/admin/cards'))
        .send({ businessName: 'Temp', slug: 'e2e-temp' })
        .expect(201);
      await authed(request(http).delete(`/api/admin/cards/${body.id}`)).expect(
        409,
      );
      await authed(request(http).patch(`/api/admin/cards/${body.id}/status`))
        .send({ status: 'archived' })
        .expect(200);
      await authed(request(http).delete(`/api/admin/cards/${body.id}`)).expect(
        204,
      );
    });
  });

  describe('analytics', () => {
    it('counts a browser visit once and ignores bots', async () => {
      const visit = (ua: string) =>
        request(http)
          .post('/api/public/cards/e2e-shop/visits')
          .set('User-Agent', ua)
          .send({});
      expect((await visit(BROWSER_UA).expect(202)).body).toEqual({
        counted: true,
      });
      expect((await visit(BROWSER_UA).expect(202)).body).toEqual({
        counted: false,
        reason: 'duplicate',
      });
      expect((await visit('WhatsApp/2.23.20 A').expect(202)).body).toEqual({
        counted: false,
        reason: 'bot',
      });
    });

    it('records clicks only for buttons that belong to the card', async () => {
      const { body: profile } = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      const click = (body: object) =>
        request(http)
          .post('/api/public/cards/e2e-shop/clicks')
          .set('User-Agent', BROWSER_UA)
          .send(body)
          .expect(202);
      expect(
        (await click({ kind: 'button', id: profile.buttons[0].id })).body
          .counted,
      ).toBe(true);
      expect(
        (
          await click({
            kind: 'button',
            id: '00000000-0000-4000-8000-000000000000',
          })
        ).body.counted,
      ).toBe(false);
      expect(
        (await click({ kind: 'contact', target: 'phone' })).body.counted,
      ).toBe(true);
    });

    it('reports totals and clicks by button', async () => {
      const { body: list } = await authed(
        request(http).get('/api/admin/cards').query({ search: 'e2e-shop' }),
      ).expect(200);
      const res = await authed(
        request(http)
          .get(`/api/admin/analytics/cards/${list.data[0].id}`)
          .query({ days: 7, tz: 'Asia/Manila' }),
      ).expect(200);
      expect(res.body.totals).toMatchObject({
        allTimeVisits: 1,
        visits: 1,
        uniqueVisitors: 1,
        clicks: 2,
      });
      expect(res.body.series).toHaveLength(7);
      expect(
        res.body.clicksByButton.map((c: { label: string }) => c.label).sort(),
      ).toEqual(['Call', 'Call']);
    });

    it('validates the time zone', () =>
      authed(
        request(http)
          .get('/api/admin/analytics/overview')
          .query({ tz: 'Mars/Base' }),
      ).expect(400));
  });

  describe('production behaviour', () => {
    const INTERNAL = { 'x-tapaccess-internal-key': 'e2e-internal-key-123456' };
    const visitAs = (ip: string, headers: Record<string, string> = INTERNAL) =>
      request(http)
        .post('/api/public/cards/e2e-shop/visits')
        .set('User-Agent', BROWSER_UA)
        .set({ ...headers, 'x-tapaccess-client-ip': ip })
        .send({})
        .expect(202);

    it('counts visitors forwarded by the web server separately', async () => {
      expect((await visitAs('203.0.113.10')).body.counted).toBe(true);
      expect((await visitAs('203.0.113.10')).body.reason).toBe('duplicate');
      expect((await visitAs('203.0.113.11')).body.counted).toBe(true);
    });

    it('ignores a forged visitor IP without the internal key', async () => {
      // Falls back to the socket IP, which already visited in this run.
      const res = await visitAs('203.0.113.99', {});
      expect(res.body).toEqual({ counted: false, reason: 'duplicate' });
    });

    it('serves a vCard that iOS and Android import', async () => {
      const res = await request(http)
        .get('/api/public/cards/e2e-shop/vcard')
        .expect(200);
      expect(res.headers['content-type']).toMatch(
        /^text\/vcard; charset=utf-8/,
      );
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="Test-Shop\.vcf"; filename\*=UTF-8''/,
      );
      const vcard = res.text;
      expect(vcard.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\nN:;;;;\r\n')).toBe(
        true,
      );
      expect(vcard).toContain('FN:Test Shop');
      expect(vcard).not.toContain('KIND:');
      expect(vcard.trimEnd().endsWith('END:VCARD')).toBe(true);
    });

    it('stores the tap action and only offers a call when there is a phone', async () => {
      const { body: list } = await authed(
        request(http).get('/api/admin/cards').query({ search: 'e2e-shop' }),
      ).expect(200);
      const { body: card }: { body: { id: string; profile: object } } =
        await authed(
          request(http).get(`/api/admin/cards/${list.data[0].id}`),
        ).expect(200);
      const save = (profile: object) =>
        authed(request(http).put(`/api/admin/cards/${card.id}/profile`))
          .send({ profile, sections: [], buttons: [], socialLinks: [] })
          .expect(200);

      await save({ ...card.profile, phone: null, tapAction: 'call' });
      const noPhone = await request(http).get('/api/public/cards/e2e-shop');
      expect(noPhone.body.tapAction).toBe('profile');

      const saved = await save({
        ...card.profile,
        phone: '+1 555 0100',
        tapAction: 'call',
      });
      expect(saved.body.profile.tapAction).toBe('call');
      const withPhone = await request(http).get('/api/public/cards/e2e-shop');
      expect(withPhone.body.tapAction).toBe('call');

      await authed(request(http).put(`/api/admin/cards/${card.id}/profile`))
        .send({
          profile: { ...card.profile, tapAction: 'explode' },
          sections: [],
          buttons: [],
          socialLinks: [],
        })
        .expect(400);
    });

    it('uploads AVIF and explains every rejected file', async () => {
      const upload = (buf: Buffer, name: string, type: string) =>
        authed(request(http).post('/api/admin/media'))
          .field('kind', 'logo')
          .attach('file', buf, { filename: name, contentType: type });
      const pixel = sharp({
        create: {
          width: 64,
          height: 64,
          channels: 3,
          background: '#4f46e5',
        },
      });

      const avif = await upload(
        await pixel.clone().avif().toBuffer(),
        'logo.avif',
        'image/avif',
      ).expect(201);
      expect(avif.body).toMatchObject({ width: 64, mimeType: 'image/webp' });

      const empty = await upload(Buffer.alloc(0), 'e.png', 'image/png');
      expect(empty.status).toBe(400);
      expect(empty.body.code).toBe('EMPTY_FILE');

      const broken = await upload(Buffer.from('nope'), 'x.png', 'image/png');
      expect(broken.body).toMatchObject({ code: 'INVALID_IMAGE' });

      const pdf = await upload(Buffer.from('%PDF'), 'a.pdf', 'application/pdf');
      expect(pdf.body.message).toMatch(/"a\.pdf" is not a supported image/);

      const heic = await upload(Buffer.from('x'), 'IMG_1.HEIC', 'image/heic');
      expect(heic.body.code).toBe('UNSUPPORTED_HEIC');

      const status = await authed(
        request(http).get('/api/admin/media/status'),
      ).expect(200);
      expect(status.body).toEqual({ provider: 'local', problem: null });
    });

    it('saves extra numbers (Smart, Globe…) and puts them in the vCard', async () => {
      const { body: list } = await authed(
        request(http).get('/api/admin/cards').query({ search: 'e2e-shop' }),
      ).expect(200);
      const { body: card } = await authed(
        request(http).get(`/api/admin/cards/${list.data[0].id}`),
      ).expect(200);
      const save = (extraPhones: unknown) =>
        authed(request(http).put(`/api/admin/cards/${card.id}/profile`)).send({
          profile: { ...card.profile, extraPhones },
          sections: [],
          buttons: card.buttons,
          socialLinks: card.socialLinks,
        });

      await save([{ label: '', number: '+63 917 000 0000' }]).expect(400);
      await save([{ label: 'Smart', number: 'call me' }]).expect(400);
      await save(
        Array.from({ length: 6 }, (_, i) => ({
          label: `N${i}`,
          number: '+63 917 000 000' + String(i),
        })),
      ).expect(400);

      const ok = await save([
        { label: 'Smart', number: '+63 918 555 0200' },
        { label: 'Globe', number: '+63 917 555 0300' },
      ]).expect(200);
      expect(ok.body.profile.extraPhones).toHaveLength(2);

      const pub = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      expect(pub.body.contact.extraPhones).toEqual([
        { label: 'Smart', number: '+63 918 555 0200' },
        { label: 'Globe', number: '+63 917 555 0300' },
      ]);
      const vcard = await request(http)
        .get('/api/public/cards/e2e-shop/vcard')
        .expect(200);
      expect(vcard.text).toContain('item1.X-ABLabel:Smart');

      // The main phone can carry a label too.
      const labelled = await authed(
        request(http).put(`/api/admin/cards/${card.id}/profile`),
      )
        .send({
          profile: {
            ...card.profile,
            phone: '+63 917 555 0100',
            phoneLabel: 'Globe',
          },
          sections: [],
          buttons: card.buttons,
          socialLinks: card.socialLinks,
        })
        .expect(200);
      expect(labelled.body.profile.phoneLabel).toBe('Globe');
      const pub2 = await request(http)
        .get('/api/public/cards/e2e-shop')
        .expect(200);
      expect(pub2.body.contact.phoneLabel).toBe('Globe');
      expect(vcard.text).toContain('TEL;TYPE=CELL:+639175550300');
    });

    it('rejects a WhatsApp number without a country code', async () => {
      const { body: list } = await authed(
        request(http).get('/api/admin/cards').query({ search: 'e2e-shop' }),
      ).expect(200);
      const { body: card } = await authed(
        request(http).get(`/api/admin/cards/${list.data[0].id}`),
      ).expect(200);
      const res = await authed(
        request(http).put(`/api/admin/cards/${card.id}/profile`),
      )
        .send({
          profile: { ...card.profile, whatsapp: '0917 123 4567' },
          sections: [],
          buttons: [],
          socialLinks: [],
        })
        .expect(400);
      expect(res.body.message).toMatch(/country code/);
    });
  });

  describe('owner access (Business)', () => {
    let cardId: string;
    let ownerCookie: string;
    let code: string;
    const ownerCookieFrom = (res: request.Response) => {
      const set = ([] as string[])
        .concat(res.headers['set-cookie'] ?? [])
        .find((c) => c.includes('_owner='));
      expect(set).toMatch(/HttpOnly/);
      return set!.split(';')[0];
    };
    const link = (label: string, url: string, id?: string) => ({
      ...(id ? { id } : {}),
      label,
      url,
      icon: 'link',
      enabled: true,
      highlighted: false,
    });

    it('is only for Business cards', async () => {
      const starter = await authed(request(http).post('/api/admin/cards'))
        .send({
          businessName: 'Starter Owner',
          slug: 'e2e-owner-starter',
          plan: 'starter',
        })
        .expect(201);
      const res = await authed(
        request(http).post(`/api/admin/cards/${starter.body.id}/owner-access`),
      ).expect(400);
      expect(res.body.code).toBe('OWNER_ACCESS_BUSINESS_ONLY');
    });

    it('issues a one-time code and shows the edit button publicly', async () => {
      const created = await authed(request(http).post('/api/admin/cards'))
        .send({
          businessName: 'Owner Shop',
          slug: 'e2e-owner',
          plan: 'business',
        })
        .expect(201);
      cardId = created.body.id;
      await authed(request(http).patch(`/api/admin/cards/${cardId}/status`))
        .send({ status: 'active' })
        .expect(200);

      const res = await authed(
        request(http).post(`/api/admin/cards/${cardId}/owner-access`),
      ).expect(201);
      code = res.body.ownerCode;
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
      expect(res.body.slug).toBe('e2e-owner');
      expect(res.body.ownerAccess).toMatchObject({
        enabled: true,
        active: true,
      });

      const detail = await authed(
        request(http).get(`/api/admin/cards/${cardId}`),
      );
      expect(JSON.stringify(detail.body)).not.toContain(code);
      const pub = await request(http)
        .get('/api/public/cards/e2e-owner')
        .expect(200);
      expect(pub.body.ownerEditing).toBe(true);
    });

    it('signs the owner in with the code (case and dashes ignored)', async () => {
      const wrong = await request(http)
        .post('/api/owner/login')
        .send({ slug: 'e2e-owner', code: 'AAAAA-BBBBB' })
        .expect(401);
      expect(wrong.body.code).toBe('OWNER_LOGIN_FAILED');
      // The right code for a different card doesn't work.
      await request(http)
        .post('/api/owner/login')
        .send({ slug: 'e2e-owner-starter', code })
        .expect(401);

      const res = await request(http)
        .post('/api/owner/login')
        .send({ slug: 'e2e-owner', code: code.toLowerCase().replace('-', ' ') })
        .expect(200);
      ownerCookie = ownerCookieFrom(res);
      expect(res.body).toMatchObject({
        slug: 'e2e-owner',
        businessName: 'Owner Shop',
      });
      expect(res.body).not.toHaveProperty('notes');
    });

    it('lets the owner edit only buttons and social links', async () => {
      const sneaky = await request(http)
        .put('/api/owner/card')
        .set('Cookie', ownerCookie)
        .send({
          buttons: [],
          socialLinks: [],
          profile: { businessName: 'Hacked' },
        })
        .expect(400); // unknown fields are rejected outright
      expect(sneaky.body.message).toMatch(/profile/);

      const ok = await request(http)
        .put('/api/owner/card')
        .set('Cookie', ownerCookie)
        .send({
          buttons: [link('Book now', 'https://book.example')],
          socialLinks: [
            {
              platform: 'instagram',
              url: 'https://instagram.com/owner',
              enabled: true,
            },
          ],
        })
        .expect(200);
      expect(ok.body.buttons).toHaveLength(1);
      expect(ok.body.lastEditAt).toBeTruthy();

      const pub = await request(http)
        .get('/api/public/cards/e2e-owner')
        .expect(200);
      expect(pub.body.businessName).toBe('Owner Shop');
      expect(pub.body.buttons.map((b: { label: string }) => b.label)).toEqual([
        'Book now',
      ]);
      expect(pub.body.socialLinks[0].url).toBe('https://instagram.com/owner');

      // Unsafe links are refused…
      await request(http)
        .put('/api/owner/card')
        .set('Cookie', ownerCookie)
        .send({ buttons: [link('x', 'javascript:alert(1)')], socialLinks: [] })
        .expect(400);
      // …and so are rows that belong to another card.
      const { body: list } = await authed(
        request(http).get('/api/admin/cards').query({ search: 'e2e-shop' }),
      );
      const { body: other } = await authed(
        request(http).get(`/api/admin/cards/${list.data[0].id}`),
      );
      await authed(request(http).put(`/api/admin/cards/${other.id}/profile`))
        .send({
          profile: other.profile,
          sections: [],
          buttons: [link('Theirs', 'https://theirs.example')],
          socialLinks: [],
        })
        .expect(200);
      const { body: otherAfter } = await authed(
        request(http).get(`/api/admin/cards/${other.id}`),
      );
      await request(http)
        .put('/api/owner/card')
        .set('Cookie', ownerCookie)
        .send({
          buttons: [
            link('x', 'https://x.example', otherAfter.buttons[0].id as string),
          ],
          socialLinks: [],
        })
        .expect(400);
    });

    it('keeps owner and admin sessions apart', async () => {
      const ownerToken = ownerCookie.split('=')[1];
      const adminName = cookie.split('=')[0];
      await request(http)
        .get('/api/admin/cards')
        .set('Cookie', `${adminName}=${ownerToken}`)
        .expect(401);
      await request(http)
        .get('/api/owner/card')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('stops the admin editor from overwriting newer owner edits', async () => {
      const { body: card } = await authed(
        request(http).get(`/api/admin/cards/${cardId}`),
      );
      // An editor opened before the owner's edit (no owner edit seen yet).
      for (const stale of [null, '2020-01-01T00:00:00.000Z']) {
        const res = await authed(
          request(http).put(`/api/admin/cards/${cardId}/profile`),
        )
          .send({
            baseOwnerEditAt: stale,
            profile: card.profile,
            sections: [],
            buttons: [],
            socialLinks: [],
          })
          .expect(409);
        expect(res.body.code).toBe('OWNER_EDITED');
      }
      // An editor that has seen the owner's latest edit saves normally.
      await authed(request(http).put(`/api/admin/cards/${cardId}/profile`))
        .send({
          baseOwnerEditAt: card.ownerAccess.lastEditAt,
          profile: card.profile,
          sections: [],
          buttons: card.buttons,
          socialLinks: card.socialLinks,
        })
        .expect(200);
    });

    it('a new code or switching off ends the owner session', async () => {
      const fresh = await authed(
        request(http).post(`/api/admin/cards/${cardId}/owner-access`),
      ).expect(201);
      expect(fresh.body.ownerCode).not.toBe(code);
      const ended = await request(http)
        .get('/api/owner/card')
        .set('Cookie', ownerCookie)
        .expect(401);
      expect(ended.body.code).toBe('OWNER_SESSION_ENDED');
      await request(http)
        .post('/api/owner/login')
        .send({ slug: 'e2e-owner', code })
        .expect(401);

      const again = await request(http)
        .post('/api/owner/login')
        .send({ slug: 'e2e-owner', code: fresh.body.ownerCode })
        .expect(200);
      const second = ownerCookieFrom(again);
      await authed(
        request(http).delete(`/api/admin/cards/${cardId}/owner-access`),
      ).expect(200);
      await request(http)
        .get('/api/owner/card')
        .set('Cookie', second)
        .expect(401);
      const pub = await request(http)
        .get('/api/public/cards/e2e-owner')
        .expect(200);
      expect(pub.body.ownerEditing).toBe(false);
    });
  });
});
