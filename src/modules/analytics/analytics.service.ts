import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { DataSource, LessThan, MoreThan, Repository } from 'typeorm';
import {
  clientIp,
  deviceTypeFromUa,
  isLikelyBot,
  referrerHost,
  userAgent,
} from '../../common/utils/request-meta';
import type { InternalRequest } from '../../common/internal-request';
import type { AppConfig } from '../../config/env';
import {
  ButtonClick,
  CardButton,
  CardSection,
  CardStatus,
  CardVisit,
  ClickKind,
  NfcCard,
  SectionItem,
  SocialLink,
  SocialPlatform,
} from '../../entities';
import { CONTACT_TARGETS, TrackClickDto } from './analytics.dto';

/** Repeat views of the same card by the same visitor within this window count once. */
const VISIT_DEDUPE_MS = 30 * 60 * 1000;
/** Ignore accidental double taps on the same action. */
const CLICK_DEDUPE_MS = 5 * 1000;

const CONTACT_LABELS: Record<(typeof CONTACT_TARGETS)[number], string> = {
  phone: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  website: 'Website',
  directions: 'Directions',
  reviews: 'Reviews',
  vcard: 'Save contact',
  share: 'Share',
};

export type TrackResult = { counted: boolean; reason?: string };

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly salt: string;
  private readonly ownHosts: string[];
  private readonly retentionDays: number;
  private purgeTimer?: NodeJS.Timeout;
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(NfcCard) private readonly cards: Repository<NfcCard>,
    @InjectRepository(CardVisit) private readonly visits: Repository<CardVisit>,
    @InjectRepository(ButtonClick)
    private readonly clicks: Repository<ButtonClick>,
    config: ConfigService<AppConfig, true>,
  ) {
    this.salt =
      config.get('ANALYTICS_SALT', { infer: true }) ??
      config.get('JWT_SECRET', { infer: true });
    this.ownHosts = [config.get('FRONTEND_URL', { infer: true })]
      .concat((config.get('CORS_ORIGINS', { infer: true }) ?? '').split(','))
      .map((o) => {
        try {
          return new URL(o.trim()).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    this.retentionDays = config.get('ANALYTICS_RETENTION_DAYS', {
      infer: true,
    });
  }

  /** Our own site never counts as a referrer, whichever domain it was opened on. */
  private ownHostsFor(req: Request): string[] {
    const site = (req as InternalRequest).trustedSiteUrl;
    if (!site) return this.ownHosts;
    return [...this.ownHosts, new URL(site).hostname.replace(/^www\./, '')];
  }

  // ─── Retention ────────────────────────────────────────────────────────────

  /**
   * Data minimisation: raw visit and click rows older than the retention
   * period are deleted at startup and then once a day.
   */
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    void this.purgeExpired();
    this.purgeTimer = setInterval(
      () => void this.purgeExpired(),
      24 * 3600 * 1000,
    );
    this.purgeTimer.unref();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async purgeExpired(): Promise<{ visits: number; clicks: number }> {
    const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
    try {
      const v = await this.visits.delete({ visitedAt: LessThan(cutoff) });
      const c = await this.clicks.delete({ clickedAt: LessThan(cutoff) });
      const result = { visits: v.affected ?? 0, clicks: c.affected ?? 0 };
      if (result.visits || result.clicks) {
        this.logger.log(
          `Deleted analytics older than ${this.retentionDays} days: ${result.visits} visits, ${result.clicks} clicks`,
        );
      }
      return result;
    } catch (err) {
      this.logger.warn(`Analytics purge failed: ${(err as Error).message}`);
      return { visits: 0, clicks: 0 };
    }
  }

  // ─── Tracking (public) ────────────────────────────────────────────────────

  async recordVisit(
    slug: string,
    req: Request,
    referrer?: string,
  ): Promise<TrackResult> {
    const ua = userAgent(req);
    if (isLikelyBot(ua)) return { counted: false, reason: 'bot' };
    const card = await this.activeCard(slug);
    const visitorHash = this.visitorHash(card.id, req, ua);

    const recent = await this.visits.exists({
      where: {
        cardId: card.id,
        visitorHash,
        visitedAt: MoreThan(new Date(Date.now() - VISIT_DEDUPE_MS)),
      },
    });
    if (recent) return { counted: false, reason: 'duplicate' };

    await this.visits.insert({
      cardId: card.id,
      visitorHash,
      deviceType: deviceTypeFromUa(ua),
      referrerHost: referrerHost(referrer, this.ownHostsFor(req)),
    });
    return { counted: true };
  }

  async recordClick(
    slug: string,
    req: Request,
    dto: TrackClickDto,
  ): Promise<TrackResult> {
    const ua = userAgent(req);
    if (isLikelyBot(ua)) return { counted: false, reason: 'bot' };
    const card = await this.activeCard(slug);
    const resolved = await this.resolveClickTarget(card.id, dto);
    if (!resolved) return { counted: false, reason: 'unknown-target' };

    const visitorHash = this.visitorHash(card.id, req, ua);
    const recent = await this.clicks.exists({
      where: {
        cardId: card.id,
        visitorHash,
        target: resolved.target,
        clickedAt: MoreThan(new Date(Date.now() - CLICK_DEDUPE_MS)),
      },
    });
    if (recent) return { counted: false, reason: 'duplicate' };

    await this.clicks.insert({
      cardId: card.id,
      visitorHash,
      kind: dto.kind,
      ...resolved,
    });
    return { counted: true };
  }

  // ─── Reporting (admin) ────────────────────────────────────────────────────

  async overview(days: number, tz: string) {
    const [totals] = await this.db.query<
      {
        allTimeVisits: number;
        visits: number;
        uniqueVisitors: number;
        clicks: number;
      }[]
    >(
      `WITH range AS (SELECT ${rangeStartSql('$2')} AS start)
       SELECT
         (SELECT COUNT(*) FROM card_visits)::int AS "allTimeVisits",
         (SELECT COUNT(*) FROM card_visits, range WHERE visited_at >= range.start)::int AS "visits",
         (SELECT COUNT(DISTINCT (visitor_hash, (visited_at AT TIME ZONE $1)::date))
            FROM card_visits, range WHERE visited_at >= range.start)::int AS "uniqueVisitors",
         (SELECT COUNT(*) FROM button_clicks, range WHERE clicked_at >= range.start)::int AS "clicks"`,
      [tz, days],
    );

    const series = await this.dailySeries(days, tz);
    const topCards = await this.db.query<
      {
        cardId: string;
        slug: string;
        businessName: string;
        status: CardStatus;
        visits: number;
      }[]
    >(
      `WITH range AS (SELECT ${rangeStartSql('$2')} AS start)
       SELECT c.id AS "cardId", c.slug, p.business_name AS "businessName", c.status, COUNT(v.id)::int AS visits
         FROM card_visits v
         JOIN range ON v.visited_at >= range.start
         JOIN nfc_cards c ON c.id = v.card_id
         JOIN card_profiles p ON p.card_id = c.id
        GROUP BY c.id, p.business_name
        ORDER BY visits DESC
        LIMIT 5`,
      [tz, days],
    );

    return { days, tz, totals, series, topCards };
  }

  async cardAnalytics(cardId: string, days: number, tz: string) {
    if (!(await this.cards.exists({ where: { id: cardId } })))
      throw new NotFoundException('Card not found');

    const [totals] = await this.db.query<
      {
        allTimeVisits: number;
        visits: number;
        uniqueVisitors: number;
        clicks: number;
      }[]
    >(
      `WITH range AS (SELECT ${rangeStartSql('$2')} AS start)
       SELECT
         (SELECT COUNT(*) FROM card_visits WHERE card_id = $3)::int AS "allTimeVisits",
         (SELECT COUNT(*) FROM card_visits, range WHERE card_id = $3 AND visited_at >= range.start)::int AS "visits",
         (SELECT COUNT(DISTINCT (visitor_hash, (visited_at AT TIME ZONE $1)::date))
            FROM card_visits, range WHERE card_id = $3 AND visited_at >= range.start)::int AS "uniqueVisitors",
         (SELECT COUNT(*) FROM button_clicks, range WHERE card_id = $3 AND clicked_at >= range.start)::int AS "clicks"`,
      [tz, days, cardId],
    );

    const series = await this.dailySeries(days, tz, cardId);

    // Group custom buttons by id (label may have changed) and built-in actions by target.
    const clicksByButton = await this.db.query<
      {
        key: string;
        kind: ClickKind;
        target: string;
        buttonId: string | null;
        label: string;
        clicks: number;
      }[]
    >(
      `WITH range AS (SELECT ${rangeStartSql('$2')} AS start)
       SELECT COALESCE(bc.button_id::text, bc.kind || ':' || bc.target) AS key,
              bc.kind, bc.target, bc.button_id AS "buttonId",
              COALESCE(MAX(b.label), (ARRAY_AGG(bc.label ORDER BY bc.clicked_at DESC))[1]) AS label,
              COUNT(*)::int AS clicks
         FROM button_clicks bc
         JOIN range ON bc.clicked_at >= range.start
         LEFT JOIN card_buttons b ON b.id = bc.button_id
        WHERE bc.card_id = $3
        GROUP BY 1, bc.kind, bc.target, bc.button_id
        ORDER BY clicks DESC
        LIMIT 50`,
      [tz, days, cardId],
    );

    const devices = await this.db.query<
      { deviceType: string; visits: number }[]
    >(
      `WITH range AS (SELECT ${rangeStartSql('$2')} AS start)
       SELECT device_type AS "deviceType", COUNT(*)::int AS visits
         FROM card_visits, range
        WHERE card_id = $3 AND visited_at >= range.start
        GROUP BY device_type ORDER BY visits DESC`,
      [tz, days, cardId],
    );

    const referrers = await this.db.query<{ host: string; visits: number }[]>(
      `WITH range AS (SELECT ${rangeStartSql('$2')} AS start)
       SELECT referrer_host AS host, COUNT(*)::int AS visits
         FROM card_visits, range
        WHERE card_id = $3 AND visited_at >= range.start AND referrer_host IS NOT NULL
        GROUP BY referrer_host ORDER BY visits DESC LIMIT 10`,
      [tz, days, cardId],
    );

    return { days, tz, totals, series, clicksByButton, devices, referrers };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** One row per calendar day in `tz`, zero-filled, oldest first. */
  private dailySeries(days: number, tz: string, cardId?: string) {
    const cardFilter = cardId ? 'AND card_id = $3' : '';
    return this.db.query<
      { date: string; visits: number; uniqueVisitors: number; clicks: number }[]
    >(
      `WITH days AS (
         SELECT d::date AS day
           FROM generate_series(
             (now() AT TIME ZONE $1)::date - ($2::int - 1),
             (now() AT TIME ZONE $1)::date,
             interval '1 day') d
       ),
       v AS (
         SELECT (visited_at AT TIME ZONE $1)::date AS day, COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS uniq
           FROM card_visits
          WHERE visited_at >= ${rangeStartSql('$2')} ${cardFilter}
          GROUP BY 1
       ),
       c AS (
         SELECT (clicked_at AT TIME ZONE $1)::date AS day, COUNT(*) AS clicks
           FROM button_clicks
          WHERE clicked_at >= ${rangeStartSql('$2')} ${cardFilter}
          GROUP BY 1
       )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
              COALESCE(v.visits, 0)::int AS visits,
              COALESCE(v.uniq, 0)::int AS "uniqueVisitors",
              COALESCE(c.clicks, 0)::int AS clicks
         FROM days
         LEFT JOIN v ON v.day = days.day
         LEFT JOIN c ON c.day = days.day
        ORDER BY days.day`,
      cardId ? [tz, days, cardId] : [tz, days],
    );
  }

  private async activeCard(slug: string): Promise<NfcCard> {
    const card = await this.cards.findOne({
      where: { slug, status: CardStatus.Active },
      select: { id: true },
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  private async resolveClickTarget(cardId: string, dto: TrackClickDto) {
    switch (dto.kind) {
      case ClickKind.Button: {
        const button = await this.db
          .getRepository(CardButton)
          .findOne({ where: { id: dto.id, cardId } });
        return button
          ? {
              buttonId: button.id,
              target: button.id,
              label: button.label.slice(0, 80),
            }
          : null;
      }
      case ClickKind.Item: {
        const item = await this.db
          .getRepository(SectionItem)
          .createQueryBuilder('i')
          .innerJoin(CardSection, 's', 's.id = i.sectionId')
          .where('i.id = :id AND s.cardId = :cardId', { id: dto.id, cardId })
          .getOne();
        return item
          ? { buttonId: null, target: item.id, label: item.title.slice(0, 80) }
          : null;
      }
      case ClickKind.Social: {
        const platform = dto.target as SocialPlatform;
        if (!Object.values(SocialPlatform).includes(platform)) return null;
        const link = await this.db
          .getRepository(SocialLink)
          .exists({ where: { cardId, platform } });
        if (!link) return null;
        return {
          buttonId: null,
          target: platform,
          label:
            platform === SocialPlatform.X
              ? 'X'
              : platform === SocialPlatform.GoogleReviews
                ? 'Google Reviews'
                : capitalise(platform),
        };
      }
      case ClickKind.Contact: {
        const target = dto.target as (typeof CONTACT_TARGETS)[number];
        if (!CONTACT_TARGETS.includes(target)) return null;
        return { buttonId: null, target, label: CONTACT_LABELS[target] };
      }
    }
  }

  /**
   * sha256(salt, UTC date, card, IP, user agent), truncated. The IP and UA
   * are never stored, and because the date is part of the input the same
   * person produces an unrelated hash tomorrow.
   */
  private visitorHash(
    cardId: string,
    req: Request,
    ua: string | undefined,
  ): string {
    const day = new Date().toISOString().slice(0, 10);
    return createHash('sha256')
      .update(`${this.salt}|${day}|${cardId}|${clientIp(req)}|${ua ?? ''}`)
      .digest('hex')
      .slice(0, 32);
  }
}

/** Start of the first day of a `days`-long window, as a timestamptz in zone $1. */
function rangeStartSql(daysParam: string): string {
  return `(((now() AT TIME ZONE $1)::date - (${daysParam}::int - 1))::timestamp AT TIME ZONE $1)`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
