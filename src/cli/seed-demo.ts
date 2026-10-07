/**
 * Development-only sample data: three fictional businesses with generated
 * artwork and ~6 weeks of synthetic analytics so the dashboard has
 * something to show.
 *
 *   npm run seed:demo            # adds demo cards that do not exist yet
 *   npm run seed:demo -- --reset # deletes and recreates the demo cards
 *
 * Refuses to run when NODE_ENV=production.
 */
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import {
  ButtonClick,
  CardPlan,
  CardStatus,
  CardVisit,
  ClickKind,
  DeviceType,
  MediaKind,
  NfcCard,
  SectionType,
  SocialPlatform,
  type ThemeConfig,
} from '../entities';
import { CardsService } from '../modules/cards/cards.service';
import { SaveProfileDto } from '../modules/cards/dto/profile.dto';
import { MediaService } from '../modules/media/media.service';

if (process.env.NODE_ENV === 'production') {
  console.error(
    '✖ seed:demo is disabled in production. Sample profiles must never be published.',
  );
  process.exit(1);
}

type DemoItem = Partial<SaveProfileDto['sections'][number]['items'][number]> & {
  title: string;
};

interface Demo {
  slug: string;
  status: CardStatus;
  plan: CardPlan;
  notes: string;
  initials: string;
  palette: [string, string];
  profile: Omit<
    SaveProfileDto['profile'],
    | 'theme'
    | 'openingHours'
    | 'logoUrl'
    | 'coverUrl'
    | 'tapAction'
    | 'extraPhones'
  >;
  theme: ThemeConfig;
  hours: [open: string, close: string, closedDays: number[]];
  sections: {
    type: SectionType;
    enabled: boolean;
    title?: string;
    items?: DemoItem[];
  }[];
  buttons: {
    label: string;
    url: string;
    icon: string;
    highlighted?: boolean;
  }[];
  socials: { platform: SocialPlatform; url: string }[];
  galleryCount: number;
  /** Starter cards get no generated artwork. */
  images?: boolean;
}

const DEMOS: Demo[] = [
  {
    slug: 'activezone-001',
    status: CardStatus.Active,
    plan: CardPlan.Business,
    notes: 'Demo card. 50 PVC cards ordered; front logo print, matte finish.',
    initials: 'AZ',
    palette: ['#16a34a', '#0b0f19'],
    profile: {
      businessName: 'ActiveZone Fitness',
      tagline: 'Strength, conditioning & community — open 6am to 10pm',
      description:
        'ActiveZone is a 24/7-friendly training club with certified coaches, a full free-weights floor and small-group classes for every level.\n\nYour first week is on us.',
      category: 'Gym & Fitness',
      phone: '+1 415 555 0142',
      whatsapp: '+1 415 555 0142',
      email: 'hello@activezone.example',
      website: 'https://activezone.example',
      address: '2150 Mission Street, San Francisco, CA 94110',
      mapsUrl: 'https://maps.google.com/?q=2150+Mission+Street+San+Francisco',
      reviewsUrl: 'https://g.page/r/activezone-demo/review',
      hoursNote: 'Members have 24/7 key-fob access.',
    },
    theme: {
      primaryColor: '#a3e635',
      accentColor: '#22c55e',
      backgroundColor: '#0b0b0c',
      surfaceColor: '#161618',
      textColor: '#f5f5f4',
      mutedTextColor: '#a1a1aa',
      backgroundStyle: 'solid',
      gradientTo: '#161618',
      backgroundImageUrl: null,
      fontHeading: 'inter-tight',
      fontBody: 'inter',
      buttonStyle: 'solid',
      buttonShape: 'pill',
      layout: 'classic',
    },
    hours: ['06:00', '22:00', []],
    sections: [
      { type: SectionType.Actions, enabled: true },
      {
        type: SectionType.Promotions,
        enabled: true,
        items: [
          {
            title: 'First week free',
            description: 'Unlimited classes for 7 days. No card needed.',
            badge: 'New members',
          },
        ],
      },
      { type: SectionType.About, enabled: true },
      {
        type: SectionType.Services,
        enabled: true,
        title: 'Programs',
        items: [
          {
            title: 'Personal training',
            description:
              '1:1 coaching with a custom plan and monthly check-ins.',
            price: 'From $60',
          },
          {
            title: 'HIIT & conditioning',
            description: '45-minute high-energy group sessions.',
            price: 'Included',
          },
          {
            title: 'Yoga & mobility',
            description: 'Recover better and move pain-free.',
            price: 'Included',
          },
        ],
      },
      {
        type: SectionType.Products,
        enabled: true,
        title: 'Memberships',
        items: [
          {
            title: 'Monthly',
            price: '$49 / mo',
            description: 'Cancel anytime.',
          },
          {
            title: 'Annual',
            price: '$499 / yr',
            description: 'Two months free.',
            badge: 'Best value',
          },
        ],
      },
      { type: SectionType.Gallery, enabled: true, title: 'Inside the club' },
      { type: SectionType.Hours, enabled: true },
      { type: SectionType.Contact, enabled: true },
      { type: SectionType.Location, enabled: true },
      { type: SectionType.Social, enabled: true },
    ],
    buttons: [
      {
        label: 'Book a free trial',
        url: 'https://activezone.example/trial',
        icon: 'calendar',
        highlighted: true,
      },
      {
        label: 'Class schedule',
        url: 'https://activezone.example/schedule',
        icon: 'clock',
      },
      {
        label: 'Membership plans',
        url: 'https://activezone.example/plans',
        icon: 'credit-card',
      },
      {
        label: 'Leave us a review',
        url: 'https://g.page/r/activezone-demo/review',
        icon: 'star',
      },
    ],
    socials: [
      {
        platform: SocialPlatform.Instagram,
        url: 'https://instagram.com/activezone.demo',
      },
      {
        platform: SocialPlatform.Facebook,
        url: 'https://facebook.com/activezone.demo',
      },
      {
        platform: SocialPlatform.TikTok,
        url: 'https://tiktok.com/@activezone.demo',
      },
      {
        platform: SocialPlatform.YouTube,
        url: 'https://youtube.com/@activezone.demo',
      },
    ],
    galleryCount: 4,
  },
  {
    slug: 'bean-and-bloom',
    status: CardStatus.Active,
    plan: CardPlan.Business,
    notes: 'Demo card. Wooden NFC cards for the counter + table tents.',
    initials: 'BB',
    palette: ['#b45309', '#fde68a'],
    profile: {
      businessName: 'Bean & Bloom Café',
      tagline: 'Specialty coffee, fresh pastries & a little garden',
      description:
        'A neighbourhood café roasting single-origin beans in small batches. Bring your laptop or your dog.',
      category: 'Café',
      phone: '+1 503 555 0199',
      whatsapp: null,
      email: 'hi@beanandbloom.example',
      website: 'https://beanandbloom.example',
      address: '88 Alder Street, Portland, OR 97205',
      mapsUrl: 'https://maps.google.com/?q=88+Alder+Street+Portland',
      reviewsUrl: 'https://g.page/r/beanandbloom-demo/review',
      hoursNote: 'Kitchen closes 30 minutes before closing time.',
    },
    theme: {
      primaryColor: '#7c2d12',
      accentColor: '#b45309',
      backgroundColor: '#faf6f1',
      surfaceColor: '#ffffff',
      textColor: '#292524',
      mutedTextColor: '#78716c',
      backgroundStyle: 'solid',
      gradientTo: '#f3ece3',
      backgroundImageUrl: null,
      fontHeading: 'instrument-serif',
      fontBody: 'inter',
      buttonStyle: 'solid',
      buttonShape: 'pill',
      layout: 'classic',
    },
    hours: ['07:00', '17:00', [6]],
    sections: [
      { type: SectionType.Actions, enabled: true },
      {
        type: SectionType.Announcements,
        enabled: true,
        title: 'News',
        items: [
          {
            title: 'Now open Saturdays',
            description: 'Brunch menu from 8am to 2pm every Saturday.',
          },
        ],
      },
      {
        type: SectionType.Products,
        enabled: true,
        title: 'Menu favourites',
        items: [
          { title: 'Flat white', price: '$4.50' },
          { title: 'Iced honey latte', price: '$5.25', badge: 'Seasonal' },
          { title: 'Almond croissant', price: '$3.95' },
          { title: 'Avocado sourdough', price: '$9.50' },
        ],
      },
      { type: SectionType.About, enabled: true, title: 'Our story' },
      { type: SectionType.Gallery, enabled: true },
      { type: SectionType.Hours, enabled: true },
      { type: SectionType.Location, enabled: true },
      { type: SectionType.Contact, enabled: true },
      { type: SectionType.Social, enabled: true },
    ],
    buttons: [
      {
        label: 'Order ahead',
        url: 'https://beanandbloom.example/order',
        icon: 'coffee',
        highlighted: true,
      },
      {
        label: 'Full menu (PDF)',
        url: 'https://beanandbloom.example/menu.pdf',
        icon: 'menu',
      },
      {
        label: 'Reserve a table',
        url: 'https://beanandbloom.example/reserve',
        icon: 'utensils',
      },
    ],
    socials: [
      {
        platform: SocialPlatform.Instagram,
        url: 'https://instagram.com/beanandbloom.demo',
      },
      {
        platform: SocialPlatform.Facebook,
        url: 'https://facebook.com/beanandbloom.demo',
      },
    ],
    galleryCount: 3,
  },
  {
    slug: 'lumen-dental',
    status: CardStatus.Inactive,
    plan: CardPlan.Business,
    notes: 'Demo card. Awaiting final logo from client before activation.',
    initials: 'LD',
    palette: ['#0ea5e9', '#e0f2fe'],
    profile: {
      businessName: 'Lumen Dental Studio',
      tagline: 'Gentle, modern dentistry for the whole family',
      description:
        'Check-ups, whitening, aligners and same-day emergency care.',
      category: 'Dental Clinic',
      phone: '+1 212 555 0123',
      whatsapp: null,
      email: 'care@lumendental.example',
      website: 'https://lumendental.example',
      address: '410 Park Avenue South, New York, NY 10016',
      mapsUrl: null,
      reviewsUrl: null,
      hoursNote: null,
    },
    theme: {
      primaryColor: '#0c4a6e',
      accentColor: '#0ea5e9',
      backgroundColor: '#f5f7fa',
      surfaceColor: '#ffffff',
      textColor: '#0f172a',
      mutedTextColor: '#64748b',
      backgroundStyle: 'solid',
      gradientTo: '#e2e8f0',
      backgroundImageUrl: null,
      fontHeading: 'manrope',
      fontBody: 'inter',
      buttonStyle: 'solid',
      buttonShape: 'pill',
      layout: 'classic',
    },
    hours: ['09:00', '18:00', [5, 6]],
    sections: [
      { type: SectionType.Actions, enabled: true },
      { type: SectionType.About, enabled: true },
      {
        type: SectionType.Services,
        enabled: true,
        items: [
          { title: 'Check-up & clean' },
          { title: 'Teeth whitening' },
          { title: 'Clear aligners' },
        ],
      },
      { type: SectionType.Contact, enabled: true },
      { type: SectionType.Hours, enabled: true },
    ],
    buttons: [
      {
        label: 'Book an appointment',
        url: 'https://lumendental.example/book',
        icon: 'stethoscope',
        highlighted: true,
      },
    ],
    socials: [],
    galleryCount: 0,
  },
  {
    slug: 'quickfix-plumbing',
    status: CardStatus.Active,
    plan: CardPlan.Starter,
    notes:
      'Demo card on the Starter package: About, buttons, contact and Facebook.',
    initials: 'QF',
    palette: ['#2563eb', '#0f172a'],
    profile: {
      businessName: 'QuickFix Plumbing',
      tagline: 'Licensed plumber · same-day call-outs',
      description:
        'Leaks, blocked drains, water heaters and bathroom fit-outs. Upfront quotes, no call-out fee within 10 km.',
      category: 'Plumbing',
      phone: '+1 646 555 0177',
      whatsapp: '+1 646 555 0177',
      email: 'jobs@quickfix.example',
      website: null,
      address: null,
      mapsUrl: null,
      reviewsUrl: null,
      hoursNote: null,
    },
    theme: {
      primaryColor: '#4f46e5',
      accentColor: '#06b6d4',
      backgroundColor: '#f8fafc',
      surfaceColor: '#ffffff',
      textColor: '#0f172a',
      mutedTextColor: '#64748b',
      backgroundStyle: 'solid',
      gradientTo: '#e0e7ff',
      backgroundImageUrl: null,
      fontHeading: 'poppins',
      fontBody: 'inter',
      buttonStyle: 'solid',
      buttonShape: 'rounded',
      layout: 'minimal',
    },
    hours: ['08:00', '18:00', [6]],
    sections: [
      { type: SectionType.Actions, enabled: true },
      { type: SectionType.About, enabled: true },
    ],
    buttons: [
      {
        label: 'Request a quote',
        url: 'https://quickfix.example/quote',
        icon: 'file-text',
        highlighted: true,
      },
      { label: 'Emergency call-out', url: 'tel:+16465550177', icon: 'phone' },
    ],
    socials: [],
    galleryCount: 0,
    images: false,
  },
];

// ─── Generated artwork ──────────────────────────────────────────────────────

const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

const logoSvg = (initials: string, [a, b]: [string, string]) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <text x="50%" y="54%" font-family="Arial, Helvetica, sans-serif" font-size="200" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
</svg>`;

const coverSvg = ([a, b]: [string, string], seed: number) => {
  const circles = Array.from({ length: 7 }, (_, i) => {
    const x = (seed * 97 + i * 263) % 1600;
    const y = (seed * 53 + i * 151) % 900;
    const r = 80 + ((seed + i * 37) % 220);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" fill-opacity="${0.05 + (i % 4) * 0.04}"/>`;
  }).join('');
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#g)"/>${circles}
</svg>`;
};

function fakeFile(buffer: Buffer, name: string): Express.Multer.File {
  return {
    buffer,
    originalname: name,
    mimetype: 'image/png',
    size: buffer.length,
  } as Express.Multer.File;
}

// ─── Synthetic analytics ────────────────────────────────────────────────────

const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const hash = () => randomBytes(16).toString('hex');

async function seedAnalytics(
  db: DataSource,
  card: Awaited<ReturnType<CardsService['get']>>,
) {
  const visits: Partial<CardVisit>[] = [];
  const clicks: Partial<ButtonClick>[] = [];
  const devices = [
    DeviceType.Mobile,
    DeviceType.Mobile,
    DeviceType.Mobile,
    DeviceType.Mobile,
    DeviceType.Tablet,
    DeviceType.Desktop,
  ];
  const referrers = [
    null,
    null,
    null,
    null,
    'instagram.com',
    'facebook.com',
    'google.com',
  ];
  const contact = ['phone', 'email', 'directions', 'vcard', 'website'];

  for (let daysAgo = 44; daysAgo >= 0; daysAgo--) {
    const day = new Date(Date.now() - daysAgo * 86_400_000);
    const weekend = [0, 6].includes(day.getDay());
    const growth = 1 + (44 - daysAgo) / 30;
    const n = Math.round((weekend ? 9 : 5) * growth + Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const at = new Date(day);
      at.setHours(
        7 + Math.floor(Math.random() * 14),
        Math.floor(Math.random() * 60),
      );
      if (at > new Date()) continue;
      const visitorHash = hash();
      visits.push({
        cardId: card.id,
        visitedAt: at,
        visitorHash,
        deviceType: pick(devices),
        referrerHost: pick(referrers),
      });
      if (Math.random() < 0.55) {
        const button =
          card.buttons.length && Math.random() < 0.6
            ? pick(card.buttons)
            : null;
        const clickedAt = new Date(at.getTime() + 20_000);
        if (button) {
          clicks.push({
            cardId: card.id,
            buttonId: button.id,
            kind: ClickKind.Button,
            target: button.id,
            label: button.label,
            visitorHash,
            clickedAt,
          });
        } else if (card.socialLinks.length && Math.random() < 0.3) {
          const s = pick(card.socialLinks);
          clicks.push({
            cardId: card.id,
            buttonId: null,
            kind: ClickKind.Social,
            target: s.platform,
            label: s.platform[0].toUpperCase() + s.platform.slice(1),
            visitorHash,
            clickedAt,
          });
        } else {
          const target = pick(contact);
          const labels: Record<string, string> = {
            phone: 'Call',
            email: 'Email',
            directions: 'Directions',
            vcard: 'Save contact',
            website: 'Website',
          };
          clicks.push({
            cardId: card.id,
            buttonId: null,
            kind: ClickKind.Contact,
            target,
            label: labels[target],
            visitorHash,
            clickedAt,
          });
        }
      }
    }
  }
  // CreateDateColumn would overwrite the timestamps, so use a raw insert.
  await db
    .createQueryBuilder()
    .insert()
    .into(CardVisit)
    .values(visits)
    .updateEntity(false)
    .execute();
  if (clicks.length)
    await db
      .createQueryBuilder()
      .insert()
      .into(ButtonClick)
      .values(clicks)
      .updateEntity(false)
      .execute();
  return { visits: visits.length, clicks: clicks.length };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const cards = app.get(CardsService);
  const media = app.get(MediaService);
  const db = app.get<DataSource>(getDataSourceToken());
  const reset = process.argv.includes('--reset');

  try {
    for (const demo of DEMOS) {
      const existing = await db
        .getRepository(NfcCard)
        .findOneBy({ slug: demo.slug });
      if (existing && !reset) {
        console.log(
          `• ${demo.slug} already exists — skipped (use --reset to recreate)`,
        );
        continue;
      }
      if (existing) {
        await media.removeAllForCard(existing.id);
        await db.getRepository(NfcCard).delete(existing.id);
      }

      const created = await cards.create({
        businessName: demo.profile.businessName,
        slug: demo.slug,
        plan: demo.plan,
        category: demo.profile.category,
        notes: demo.notes,
      });

      const seed = demo.slug.length;
      const withImages = demo.images !== false;
      const logo =
        withImages &&
        (await media.upload(
          fakeFile(await png(logoSvg(demo.initials, demo.palette)), 'logo.png'),
          MediaKind.Logo,
          created.id,
        ));
      const cover =
        withImages &&
        (await media.upload(
          fakeFile(await png(coverSvg(demo.palette, seed)), 'cover.png'),
          MediaKind.Cover,
          created.id,
        ));
      const gallery: { url: string }[] = [];
      for (let i = 0; i < demo.galleryCount; i++) {
        const shot = await media.upload(
          fakeFile(
            await png(
              coverSvg(
                [demo.palette[i % 2], demo.palette[(i + 1) % 2]],
                seed + i * 11,
              ),
            ),
            `gallery-${i + 1}.png`,
          ),
          MediaKind.Gallery,
          created.id,
        );
        gallery.push(shot);
      }

      const [open, close, closedDays] = demo.hours;
      const payload = await validated({
        profile: {
          ...demo.profile,
          logoUrl: logo ? logo.url : null,
          coverUrl: cover ? cover.url : null,
          theme: demo.theme,
          openingHours: Array.from({ length: 7 }, (_, day) => ({
            day,
            open,
            close,
            closed: closedDays.includes(day),
          })),
        },
        sections: demo.sections.map((s) => ({
          type: s.type,
          title: s.title ?? null,
          enabled: s.enabled,
          items:
            s.type === SectionType.Gallery
              ? gallery.map((g, i) => ({
                  ...blankItem(),
                  title: `Photo ${i + 1}`,
                  imageUrl: g.url,
                }))
              : (s.items ?? []).map((i) => ({ ...blankItem(), ...i })),
        })),
        buttons: demo.buttons.map((b) => ({
          ...b,
          enabled: true,
          highlighted: b.highlighted ?? false,
        })),
        socialLinks: demo.socials.map((s) => ({
          ...s,
          label: null,
          enabled: true,
        })),
      });
      await cards.saveProfile(created.id, payload);

      const final = await cards.setStatus(created.id, demo.status);
      const stats =
        demo.status === CardStatus.Active
          ? await seedAnalytics(db, final)
          : { visits: 0, clicks: 0 };
      console.log(
        `✔ ${demo.slug} (${final.cardCode}, ${demo.status}) — ${stats.visits} visits, ${stats.clicks} clicks`,
      );
    }
  } finally {
    await app.close();
  }
}

/** Runs the payload through the same validation and sanitising as the HTTP API. */
async function validated(plain: unknown): Promise<SaveProfileDto> {
  const dto = plainToInstance(SaveProfileDto, plain);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length)
    throw new Error(
      `Demo profile failed validation: ${JSON.stringify(errors, null, 2)}`,
    );
  return dto;
}

function blankItem() {
  return {
    description: null,
    price: null,
    imageUrl: null,
    linkUrl: null,
    linkLabel: null,
    badge: null,
    startsAt: null,
    endsAt: null,
    enabled: true,
  };
}

main().catch((err: Error) => {
  console.error(`\n✖ ${err.stack ?? err.message}`);
  process.exit(1);
});
