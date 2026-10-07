import { CardPlan, SectionType, SocialPlatform } from '../entities/enums';

/**
 * What each package may show on the public page. Enforced when the public
 * profile is built, so changing a card's package never deletes content:
 * downgrading hides it, upgrading brings it back.
 *
 * Every package gets the full theme editor (colours, fonts, buttons, layout).
 *
 * Mirrored in `tapaccess-frontend/lib/plans.ts` for the editor preview.
 */
export interface PlanFeatures {
  /** Logo, cover, background image, gallery and item photos. */
  images: boolean;
  /** Which social links may appear. */
  socialPlatforms: readonly SocialPlatform[] | 'all';
  /** Sections the public page may render. */
  sections: readonly SectionType[];
  /** Sections shown whenever they have content, regardless of their toggle. */
  alwaysOn: readonly SectionType[];
}

export const PLAN_FEATURES: Record<CardPlan, PlanFeatures> = {
  // Starter: name, About, CTA buttons, contact details (with Call and Save
  // contact) and Facebook / Instagram / TikTok / X / Google Reviews, fully
  // themed, but no photos.
  [CardPlan.Starter]: {
    images: false,
    socialPlatforms: [
      SocialPlatform.Facebook,
      SocialPlatform.Instagram,
      SocialPlatform.TikTok,
      SocialPlatform.X,
      SocialPlatform.GoogleReviews,
    ],
    sections: [
      SectionType.Actions,
      SectionType.About,
      SectionType.Contact,
      SectionType.Social,
    ],
    alwaysOn: [SectionType.Contact, SectionType.Social],
  },
  [CardPlan.Business]: {
    images: true,
    socialPlatforms: 'all',
    sections: Object.values(SectionType),
    alwaysOn: [],
  },
};

/** Owner self-editing (CTA buttons + social links) is a Business feature. */
export const ownerAccessAllowed = (plan: CardPlan) =>
  plan === CardPlan.Business;

/**
 * Whether the card's owner can sign in and edit right now: switched on by
 * the admin, a code has been issued, the card is on Business and not
 * archived. Downgrading to Starter pauses access without forgetting it.
 */
export const ownerAccessActive = (card: {
  ownerAccess: boolean;
  ownerCodeSetAt: Date | null;
  plan: CardPlan;
  status: string;
}) =>
  card.ownerAccess &&
  card.ownerCodeSetAt !== null &&
  ownerAccessAllowed(card.plan) &&
  card.status !== 'archived';
