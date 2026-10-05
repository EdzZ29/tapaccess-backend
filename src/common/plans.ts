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
  // contact) and Facebook / Instagram / TikTok / X, fully themed — but no
  // photos.
  [CardPlan.Starter]: {
    images: false,
    socialPlatforms: [
      SocialPlatform.Facebook,
      SocialPlatform.Instagram,
      SocialPlatform.TikTok,
      SocialPlatform.X,
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
