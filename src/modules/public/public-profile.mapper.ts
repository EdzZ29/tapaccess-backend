import { ownerAccessActive, PLAN_FEATURES } from '../../common/plans';
import {
  type CardSection,
  ITEM_SECTION_TYPES,
  type NfcCard,
  type SectionItem,
  type SocialLink,
  TapAction,
} from '../../entities';

const byPosition = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

const isLive = (item: SectionItem, now: Date) =>
  item.enabled &&
  (!item.startsAt || item.startsAt <= now) &&
  (!item.endsAt || item.endsAt >= now);

/**
 * Only offer an automatic action the card can actually perform: no phone
 * number means no automatic call, no contact details means nothing to save.
 */
function effectiveTapAction(
  action: TapAction,
  p: {
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    extraPhones: unknown[];
  },
): TapAction {
  if (action === TapAction.Call && !p.phone) return TapAction.Profile;
  const nothingToSave =
    !p.phone && !p.email && !p.whatsapp && !p.extraPhones?.length;
  if (action === TapAction.SaveContact && nothingToSave)
    return TapAction.Profile;
  return action;
}

/**
 * The only shape that leaves the API for anonymous visitors. Built field by
 * field (never by spreading an entity) so internal notes, card codes, status
 * history and disabled content can never leak by accident. The card's
 * package decides which images, social links and sections are included.
 */
export function toPublicProfile(card: NfcCard, now = new Date()) {
  const p = card.profile;
  const plan = PLAN_FEATURES[card.plan];
  const image = (url: string | null) => (plan.images ? url : null);
  // Every package themes its card; only the background photo needs images.
  const theme = {
    ...p.theme,
    backgroundImageUrl: image(p.theme.backgroundImageUrl),
  };
  const showSection = (s: CardSection) =>
    plan.sections.includes(s.type) &&
    (s.enabled || plan.alwaysOn.includes(s.type));
  const showSocial = (l: SocialLink) =>
    l.enabled &&
    (plan.socialPlatforms === 'all' ||
      plan.socialPlatforms.includes(l.platform));

  return {
    slug: card.slug,
    businessName: p.businessName,
    tagline: p.tagline,
    description: p.description,
    category: p.category,
    logoUrl: image(p.logoUrl),
    coverUrl: image(p.coverUrl),
    contact: {
      phone: p.phone,
      extraPhones: (p.extraPhones ?? []).map((x) => ({
        label: x.label,
        number: x.number,
      })),
      whatsapp: p.whatsapp,
      email: p.email,
      website: p.website,
      address: p.address,
      mapsUrl: p.mapsUrl,
      reviewsUrl: p.reviewsUrl,
    },
    openingHours: p.openingHours,
    hoursNote: p.hoursNote,
    theme,
    tapAction: effectiveTapAction(p.tapAction, p),
    /** Shows the owner's "Edit my links" button. */
    ownerEditing: ownerAccessActive(card),
    sections: [...card.sections]
      .filter(showSection)
      .sort(byPosition)
      .map((s) => ({
        type: s.type,
        title: s.title,
        items: ITEM_SECTION_TYPES.includes(s.type)
          ? [...(s.items ?? [])]
              .filter((i) => isLive(i, now))
              .sort(byPosition)
              .map((i) => ({
                id: i.id,
                title: i.title,
                description: i.description,
                price: i.price,
                imageUrl: image(i.imageUrl),
                linkUrl: i.linkUrl,
                linkLabel: i.linkLabel,
                badge: i.badge,
                endsAt: i.endsAt,
              }))
          : [],
      })),
    buttons: [...card.buttons]
      .filter((b) => b.enabled)
      .sort(byPosition)
      .map((b) => ({
        id: b.id,
        label: b.label,
        url: b.url,
        icon: b.icon,
        highlighted: b.highlighted,
      })),
    socialLinks: [...card.socialLinks]
      .filter(showSocial)
      .sort(byPosition)
      .map((l) => ({
        id: l.id,
        platform: l.platform,
        url: l.url,
        label: l.label,
      })),
    updatedAt: p.updatedAt > card.updatedAt ? p.updatedAt : card.updatedAt,
  };
}

export type PublicProfile = ReturnType<typeof toPublicProfile>;
