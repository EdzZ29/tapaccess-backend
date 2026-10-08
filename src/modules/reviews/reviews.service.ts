import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { PLAN_FEATURES } from '../../common/plans';
import { CardReview, CardStatus, NfcCard } from '../../entities';
import type { SubmitReviewDto } from './reviews.dto';

/** 24 random bytes, URL-safe: 32 characters. */
export const REVIEW_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** The review as the homepage shows it, or null when there's nothing to show. */
export function publicReview(review: CardReview | null | undefined) {
  if (!review || review.hidden || review.rating === null) return null;
  return {
    rating: review.rating,
    comment: review.comment ?? '',
    authorName: review.authorName ?? '',
    authorRole: review.authorRole,
  };
}

const LINK_INVALID = {
  message:
    'This review link has expired or was replaced. Ask TapAccess for a new one.',
  code: 'REVIEW_LINK_INVALID',
};

/**
 * Owner reviews of TapAccess. The admin makes a private link per card; only
 * whoever holds it (the owner) can leave or update that card's review.
 */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(CardReview)
    private readonly reviews: Repository<CardReview>,
    @InjectRepository(NfcCard) private readonly cards: Repository<NfcCard>,
  ) {}

  // ─── Admin ────────────────────────────────────────────────────────────────

  async adminView(cardId: string) {
    await this.cardOrFail(cardId);
    const review = await this.reviews.findOne({
      where: { cardId },
      select: {
        cardId: true,
        tokenHash: true,
        linkCreatedAt: true,
        rating: true,
        comment: true,
        authorName: true,
        authorRole: true,
        hidden: true,
        submittedAt: true,
        updatedAt: true,
      },
    });
    return {
      link: {
        active: Boolean(review?.tokenHash),
        createdAt: review?.tokenHash ? review.linkCreatedAt : null,
      },
      review:
        review && review.rating !== null
          ? {
              rating: review.rating,
              comment: review.comment ?? '',
              authorName: review.authorName ?? '',
              authorRole: review.authorRole,
              hidden: review.hidden,
              submittedAt: review.submittedAt,
              updatedAt: review.updatedAt,
            }
          : null,
    };
  }

  /**
   * Makes a new review link and returns its token once (only a hash is
   * kept). Any earlier link for this card stops working.
   */
  async issueLink(cardId: string) {
    const card = await this.cardOrFail(cardId);
    if (card.status === CardStatus.Archived) {
      throw new BadRequestException({
        message: 'Restore this card before asking its owner for a review.',
        code: 'CARD_ARCHIVED',
      });
    }
    const token = randomBytes(24).toString('base64url');
    await this.reviews.upsert(
      { cardId, tokenHash: hashToken(token), linkCreatedAt: new Date() },
      ['cardId'],
    );
    return { ...(await this.adminView(cardId)), token };
  }

  /** Stops the link working; a review already left stays. */
  async revokeLink(cardId: string) {
    await this.cardOrFail(cardId);
    await this.reviews.update(
      { cardId },
      { tokenHash: null, linkCreatedAt: null },
    );
    return this.adminView(cardId);
  }

  async setHidden(cardId: string, hidden: boolean) {
    await this.cardOrFail(cardId);
    await this.reviews.update({ cardId }, { hidden });
    return this.adminView(cardId);
  }

  /** Clears the review itself; the link (if on) still works for a new one. */
  async removeReview(cardId: string) {
    await this.cardOrFail(cardId);
    await this.reviews.update(
      { cardId },
      {
        rating: null,
        comment: null,
        authorName: null,
        authorRole: null,
        hidden: false,
        submittedAt: null,
      },
    );
    return this.adminView(cardId);
  }

  // ─── Owner (public, by link) ──────────────────────────────────────────────

  /** The business the link belongs to and its current review, if any. */
  async forLink(token: string) {
    const review = await this.byToken(token);
    const card = review.card;
    const p = card.profile;
    return {
      businessName: p.businessName,
      category: p.category,
      logoUrl: PLAN_FEATURES[card.plan].images ? p.logoUrl : null,
      color: p.theme.primaryColor,
      review:
        review.rating !== null
          ? {
              rating: review.rating,
              comment: review.comment ?? '',
              authorName: review.authorName ?? '',
              authorRole: review.authorRole,
            }
          : null,
    };
  }

  async submit(token: string, dto: SubmitReviewDto) {
    const review = await this.byToken(token);
    await this.reviews.update(
      { cardId: review.cardId },
      {
        rating: dto.rating,
        comment: dto.comment,
        authorName: dto.authorName,
        authorRole: dto.authorRole,
        submittedAt: review.submittedAt ?? new Date(),
      },
    );
    return this.forLink(token);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async byToken(token: string): Promise<CardReview> {
    if (!REVIEW_TOKEN_RE.test(token)) throw new NotFoundException(LINK_INVALID);
    const review = await this.reviews.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { card: { profile: true } },
    });
    if (!review || review.card.status === CardStatus.Archived) {
      throw new NotFoundException(LINK_INVALID);
    }
    return review;
  }

  private async cardOrFail(id: string): Promise<NfcCard> {
    const card = await this.cards.findOneBy({ id });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }
}
