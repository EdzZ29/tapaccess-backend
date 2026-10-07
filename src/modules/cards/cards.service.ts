import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { ownerAccessAllowed } from '../../common/plans';
import {
  generateOwnerCode,
  normalizeOwnerCode,
} from '../../common/utils/owner-code';
import { slugProblem } from '../../common/utils/slug';
import {
  CardButton,
  CardPlan,
  CardProfile,
  CardSection,
  CardSlugRedirect,
  CardStatus,
  CardVisit,
  DEFAULT_OPENING_HOURS,
  DEFAULT_THEME,
  ITEM_SECTION_TYPES,
  NfcCard,
  SectionItem,
  SectionType,
  SocialLink,
} from '../../entities';
import { hashPassword } from '../auth/password';
import { MediaService } from '../media/media.service';
import { DEFAULT_SECTIONS } from './card-defaults';
import { toCardDetail, toCardSummary, toOwnerView } from './card.mapper';
import {
  CreateCardDto,
  DuplicateCardDto,
  ListCardsQueryDto,
  UpdateCardDto,
} from './dto/card.dto';
import { SaveOwnerLinksDto } from './dto/owner.dto';
import { SaveProfileDto } from './dto/profile.dto';

const FULL_RELATIONS = {
  profile: true,
  sections: { items: true },
  buttons: true,
  socialLinks: true,
} as const;

const SORT_COLUMNS: Record<ListCardsQueryDto['sort'], string> = {
  createdAt: 'card.createdAt',
  updatedAt: 'card.updatedAt',
  businessName: 'profile.businessName',
  slug: 'card.slug',
  cardCode: 'card.cardCode',
  status: 'card.status',
};

@Injectable()
export class CardsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(NfcCard) private readonly cards: Repository<NfcCard>,
    @InjectRepository(CardVisit) private readonly visits: Repository<CardVisit>,
    private readonly media: MediaService,
  ) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async list(query: ListCardsQueryDto) {
    const qb = this.cards
      .createQueryBuilder('card')
      .innerJoinAndSelect('card.profile', 'profile');

    if (query.status === 'all')
      qb.where('card.status != :archived', { archived: CardStatus.Archived });
    else qb.where('card.status = :status', { status: query.status });

    if (query.plan) qb.andWhere('card.plan = :plan', { plan: query.plan });

    if (query.search) {
      const term = `%${query.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('profile.businessName ILIKE :term', { term })
            .orWhere('card.slug ILIKE :term', { term })
            .orWhere('card.cardCode ILIKE :term', { term })
            .orWhere('profile.category ILIKE :term', { term }),
        ),
      );
    }

    const [rows, total] = await qb
      .orderBy(SORT_COLUMNS[query.sort], query.order === 'asc' ? 'ASC' : 'DESC')
      .addOrderBy('card.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    const counts = await this.visitCounts(rows.map((r) => r.id));
    return paginate(
      rows.map((card) => toCardSummary(card, counts.get(card.id) ?? 0)),
      total,
      query,
    );
  }

  async stats() {
    const rows = await this.cards
      .createQueryBuilder('card')
      .select('card.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('card.status')
      .getRawMany<{ status: CardStatus; count: number }>();
    const by = (s: CardStatus) => rows.find((r) => r.status === s)?.count ?? 0;
    const plans = await this.cards
      .createQueryBuilder('card')
      .select('card.plan', 'plan')
      .addSelect('COUNT(*)::int', 'count')
      .where('card.status != :archived', { archived: CardStatus.Archived })
      .groupBy('card.plan')
      .getRawMany<{ plan: CardPlan; count: number }>();
    const totalVisits = await this.visits.count();
    const active = by(CardStatus.Active);
    const inactive = by(CardStatus.Inactive);
    return {
      totalCards: active + inactive,
      active,
      inactive,
      archived: by(CardStatus.Archived),
      totalVisits,
      byPlan: Object.fromEntries(
        Object.values(CardPlan).map((p) => [
          p,
          plans.find((r) => r.plan === p)?.count ?? 0,
        ]),
      ),
    };
  }

  async get(id: string) {
    const card = await this.findFull(id);
    const counts = await this.visitCounts([id]);
    const oldSlugs = await this.db.getRepository(CardSlugRedirect).find({
      where: { cardId: id },
      order: { createdAt: 'DESC' },
    });
    return toCardDetail(
      card,
      counts.get(id) ?? 0,
      oldSlugs.map((r) => r.slug),
    );
  }

  async slugAvailability(slug: string, excludeId?: string) {
    const problem = slugProblem(slug);
    if (problem) return { slug, available: false, reason: problem };
    const existing = await this.cards.findOne({
      where: { slug },
      select: { id: true },
    });
    if (existing !== null && existing.id !== excludeId) {
      return {
        slug,
        available: false,
        reason: 'This slug is already in use',
      };
    }
    // Another card's old address still forwards to that card.
    const redirect = await this.db
      .getRepository(CardSlugRedirect)
      .findOneBy({ slug });
    if (redirect && redirect.cardId !== excludeId) {
      return {
        slug,
        available: false,
        reason:
          "This was another card's address and still forwards to it, so it can't be reused",
      };
    }
    return { slug, available: true, reason: null };
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(dto: CreateCardDto) {
    await this.assertSlugFree(dto.slug);
    const id = await this.db.transaction(async (m) => {
      const card = await m.save(
        m.create(NfcCard, {
          slug: dto.slug,
          cardCode: await this.resolveCardCode(m, dto.cardCode),
          notes: dto.notes ?? null,
          plan: dto.plan,
          status: CardStatus.Inactive,
        }),
      );
      await m.save(
        m.create(CardProfile, {
          cardId: card.id,
          businessName: dto.businessName,
          category: dto.category ?? null,
          openingHours: DEFAULT_OPENING_HOURS,
          theme: DEFAULT_THEME,
        }),
      );
      await m.save(
        DEFAULT_SECTIONS.map((s, position) =>
          m.create(CardSection, { cardId: card.id, ...s, position }),
        ),
      );
      return card.id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateCardDto) {
    const card = await this.findOrFail(id);
    const previousSlug = card.slug;

    if (dto.slug !== undefined && dto.slug !== card.slug) {
      await this.assertSlugFree(dto.slug, id);
      card.slug = dto.slug;
    }
    if (dto.cardCode !== undefined && dto.cardCode !== card.cardCode) {
      if (await this.cards.exists({ where: { cardCode: dto.cardCode } })) {
        throw new ConflictException('This card ID is already in use');
      }
      card.cardCode = dto.cardCode;
    }
    if (dto.notes !== undefined) card.notes = dto.notes;
    if (dto.plan !== undefined) card.plan = dto.plan;
    if (dto.featured !== undefined) card.featured = dto.featured;

    await this.db.transaction(async (m) => {
      if (card.slug !== previousSlug) {
        // The card may be taking back one of its own old addresses.
        await m.delete(CardSlugRedirect, { slug: card.slug, cardId: id });
        // Once a card is live, its old address may be on NFC tags, QR codes
        // and shared links: keep it, forwarding to the new one.
        if (card.firstActivatedAt) {
          await m.upsert(CardSlugRedirect, { slug: previousSlug, cardId: id }, [
            'slug',
          ]);
        }
      }
      await m.save(card);
    });
    return this.get(id);
  }

  async setStatus(id: string, status: CardStatus) {
    const card = await this.findOrFail(id);
    if (card.status === status) return this.get(id);

    card.status = status;
    if (status === CardStatus.Active && !card.firstActivatedAt)
      card.firstActivatedAt = new Date();
    card.archivedAt = status === CardStatus.Archived ? new Date() : null;
    await this.cards.save(card);
    return this.get(id);
  }

  async duplicate(id: string, dto: DuplicateCardDto) {
    const source = await this.findFull(id);
    await this.assertSlugFree(dto.slug);

    const newId = await this.db.transaction(async (m) => {
      const card = await m.save(
        m.create(NfcCard, {
          slug: dto.slug,
          cardCode: await this.resolveCardCode(m, dto.cardCode),
          notes: null,
          plan: source.plan,
          status: CardStatus.Inactive,
        }),
      );
      const {
        id: _pid,
        cardId: _cid,
        card: _c,
        updatedAt: _u,
        ...profile
      } = source.profile;
      await m.save(
        m.create(CardProfile, {
          ...profile,
          cardId: card.id,
          businessName: dto.businessName ?? profile.businessName,
        }),
      );
      for (const s of source.sections) {
        const section = await m.save(
          m.create(CardSection, {
            cardId: card.id,
            type: s.type,
            title: s.title,
            position: s.position,
            enabled: s.enabled,
          }),
        );
        if (s.items?.length) {
          await m.save(
            s.items.map(
              ({
                id: _i,
                sectionId: _s,
                section: _sec,
                createdAt: _ca,
                updatedAt: _ua,
                ...rest
              }) => m.create(SectionItem, { ...rest, sectionId: section.id }),
            ),
          );
        }
      }
      if (source.buttons.length) {
        await m.save(
          source.buttons.map(
            ({
              id: _i,
              cardId: _c2,
              card: _cc,
              createdAt: _ca,
              updatedAt: _ua,
              ...rest
            }) => m.create(CardButton, { ...rest, cardId: card.id }),
          ),
        );
      }
      if (source.socialLinks.length) {
        await m.save(
          source.socialLinks.map(
            ({ id: _i, cardId: _c2, card: _cc, ...rest }) =>
              m.create(SocialLink, { ...rest, cardId: card.id }),
          ),
        );
      }
      return card.id;
    });
    return this.get(newId);
  }

  /** Permanent delete. Only archived cards can be removed, as a second safety step. */
  async remove(id: string) {
    const card = await this.findOrFail(id);
    if (card.status !== CardStatus.Archived) {
      throw new ConflictException({
        message: 'Archive the card before deleting it permanently.',
        code: 'NOT_ARCHIVED',
      });
    }
    await this.media.removeAllForCard(id);
    await this.cards.delete(id);
  }

  /**
   * Replaces the public profile with the editor's document in one
   * transaction, keeping row ids stable so click analytics stay attached to
   * their buttons across edits.
   */
  async saveProfile(id: string, dto: SaveProfileDto) {
    const card = await this.findFull(id);
    this.assertUniqueSectionTypes(dto);
    // The editor saves buttons and links too, so it must not silently undo
    // changes the card's owner made after the editor was opened.
    if (
      dto.baseOwnerEditAt !== undefined &&
      card.ownerLastEditAt &&
      (dto.baseOwnerEditAt === null ||
        card.ownerLastEditAt.getTime() !== dto.baseOwnerEditAt.getTime())
    ) {
      throw new ConflictException({
        message:
          'The card owner changed their buttons or social links after you opened this editor. Reload the editor to see their changes, then make your edits again.',
        code: 'OWNER_EDITED',
      });
    }

    await this.db.transaction(async (m) => {
      await m.update(
        CardProfile,
        { id: card.profile.id },
        { ...dto.profile, theme: { ...dto.profile.theme } },
      );

      // Sections: keyed by type. Types missing from the payload keep their
      // state and move to the end.
      const byType = new Map(card.sections.map((s) => [s.type, s]));
      const ordered = [
        ...dto.sections.map((s) => s.type),
        ...DEFAULT_SECTIONS.map((s) => s.type).filter(
          (t) => !dto.sections.some((s) => s.type === t),
        ),
      ];
      for (const [position, type] of ordered.entries()) {
        const input = dto.sections.find((s) => s.type === type);
        let section = byType.get(type);
        if (!section) {
          section = await m.save(
            m.create(CardSection, {
              cardId: id,
              type,
              position,
              enabled: input?.enabled ?? false,
              title: null,
            }),
          );
        } else {
          await m.update(
            CardSection,
            { id: section.id },
            {
              position,
              ...(input ? { enabled: input.enabled, title: input.title } : {}),
            },
          );
        }
        if (input && ITEM_SECTION_TYPES.includes(type)) {
          await this.syncRows(
            m,
            SectionItem,
            section.items ?? [],
            input.items,
            (row, position) => ({
              ...row,
              sectionId: section.id,
              position,
            }),
          );
        }
      }

      await this.syncRows(
        m,
        CardButton,
        card.buttons,
        dto.buttons,
        (row, position) => ({ ...row, cardId: id, position }),
      );
      await this.syncRows(
        m,
        SocialLink,
        card.socialLinks,
        dto.socialLinks,
        (row, position) => ({
          ...row,
          cardId: id,
          position,
        }),
      );

      // Touch the card so "last updated" reflects profile edits.
      await m.update(NfcCard, { id }, { updatedAt: new Date() });
    });

    return this.get(id);
  }

  // ─── Owner access (Business) ──────────────────────────────────────────────

  /**
   * Turns owner access on (or issues a new code) and returns the code once.
   * A new code signs the owner out of any existing session.
   */
  async issueOwnerCode(id: string) {
    const card = await this.findOrFail(id);
    if (!ownerAccessAllowed(card.plan)) {
      throw new BadRequestException({
        message:
          'Owner access is part of the Business package. Switch this card to Business first.',
        code: 'OWNER_ACCESS_BUSINESS_ONLY',
      });
    }
    if (card.status === CardStatus.Archived) {
      throw new BadRequestException({
        message: 'Restore this card before giving its owner access.',
        code: 'CARD_ARCHIVED',
      });
    }
    const code = generateOwnerCode();
    await this.cards.update(id, {
      ownerAccess: true,
      ownerCodeHash: await hashPassword(normalizeOwnerCode(code)),
      ownerCodeSetAt: new Date(),
      ownerTokenVersion: card.ownerTokenVersion + 1,
    });
    return { ...(await this.get(id)), ownerCode: code };
  }

  /** Turns owner access off, forgets the code and signs the owner out. */
  async revokeOwnerAccess(id: string) {
    const card = await this.findOrFail(id);
    await this.cards.update(id, {
      ownerAccess: false,
      ownerCodeHash: null,
      ownerCodeSetAt: null,
      ownerTokenVersion: card.ownerTokenVersion + 1,
    });
    return this.get(id);
  }

  async ownerView(id: string) {
    return toOwnerView(await this.findFull(id));
  }

  /**
   * The owner's save: replaces only the card's CTA buttons and social links
   * (row ids kept, so click stats survive). The matching sections are
   * switched on when there's something to show, so the owner's links
   * actually appear.
   */
  async saveOwnerLinks(id: string, dto: SaveOwnerLinksDto) {
    const card = await this.findFull(id);
    await this.db.transaction(async (m) => {
      await this.syncRows(
        m,
        CardButton,
        card.buttons,
        dto.buttons,
        (row, position) => ({ ...row, cardId: id, position }),
      );
      await this.syncRows(
        m,
        SocialLink,
        card.socialLinks,
        dto.socialLinks,
        (row, position) => ({ ...row, cardId: id, position }),
      );
      const show = [
        ...(dto.buttons.some((b) => b.enabled) ? [SectionType.Actions] : []),
        ...(dto.socialLinks.some((l) => l.enabled) ? [SectionType.Social] : []),
      ];
      if (show.length) {
        await m.update(
          CardSection,
          { cardId: id, type: In(show) },
          { enabled: true },
        );
      }
      const now = new Date();
      await m.update(NfcCard, { id }, { updatedAt: now, ownerLastEditAt: now });
    });
    return this.ownerView(id);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async findFull(id: string): Promise<NfcCard> {
    const card = await this.cards.findOne({
      where: { id },
      relations: FULL_RELATIONS,
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  private async findOrFail(id: string): Promise<NfcCard> {
    const card = await this.cards.findOneBy({ id });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  private async assertSlugFree(slug: string, excludeId?: string) {
    const result = await this.slugAvailability(slug, excludeId);
    if (!result.available)
      throw new ConflictException({
        message: result.reason,
        code: 'SLUG_UNAVAILABLE',
      });
  }

  private assertUniqueSectionTypes(dto: SaveProfileDto) {
    const types = dto.sections.map((s) => s.type);
    if (new Set(types).size !== types.length)
      throw new BadRequestException('Each section type may appear only once');
    for (const s of dto.sections) {
      if (!ITEM_SECTION_TYPES.includes(s.type) && s.items.length > 0) {
        throw new BadRequestException(
          `The ${s.type} section does not hold items`,
        );
      }
    }
    for (const s of dto.sections) {
      for (const i of s.items) {
        if (i.startsAt && i.endsAt && i.endsAt < i.startsAt) {
          throw new BadRequestException(`"${i.title}" ends before it starts`);
        }
      }
    }
  }

  /**
   * Diff-and-apply for an ordered child collection: update rows whose id is
   * known, insert rows without an id, delete rows no longer present. Ids that
   * do not belong to this parent are rejected rather than silently re-homed.
   */
  private async syncRows<E extends { id: string }, D extends { id?: string }>(
    m: EntityManager,
    entity: new () => E,
    existing: E[],
    incoming: D[],
    toRow: (row: Omit<D, 'id'>, position: number) => Partial<E>,
  ) {
    const known = new Set(existing.map((e) => e.id));
    const keep = new Set<string>();

    for (const [position, { id, ...rest }] of incoming.entries()) {
      const values = toRow(rest, position);
      if (id) {
        if (!known.has(id))
          throw new BadRequestException(`Unknown ${entity.name} id ${id}`);
        keep.add(id);
        await m.update(entity, id, values as never);
      } else {
        await m.save(m.create(entity, values as never));
      }
    }

    const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (removed.length) await m.delete(entity, removed);
  }

  private async resolveCardCode(
    m: EntityManager,
    requested?: string,
  ): Promise<string> {
    if (requested) {
      if (await m.exists(NfcCard, { where: { cardCode: requested } })) {
        throw new ConflictException('This card ID is already in use');
      }
      return requested;
    }
    // Skip over any codes an admin entered by hand that collide with the sequence.
    for (;;) {
      const [{ n }] = await m.query<{ n: string }[]>(
        `SELECT nextval('card_code_seq') AS n`,
      );
      const code = `TA-${n.padStart(6, '0')}`;
      if (!(await m.exists(NfcCard, { where: { cardCode: code } })))
        return code;
    }
  }

  private async visitCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.visits
      .createQueryBuilder('v')
      .select('v.cardId', 'cardId')
      .addSelect('COUNT(*)::int', 'count')
      .where('v.cardId IN (:...ids)', { ids })
      .groupBy('v.cardId')
      .getRawMany<{ cardId: string; count: number }>();
    return new Map(rows.map((r) => [r.cardId, r.count]));
  }
}
