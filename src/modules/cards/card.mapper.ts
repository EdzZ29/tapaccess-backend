import { ownerAccessActive } from '../../common/plans';
import type {
  CardButton,
  CardSection,
  NfcCard,
  SectionItem,
  SocialLink,
} from '../../entities';

const byPosition = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

export function toCardSummary(card: NfcCard, visitCount = 0) {
  return {
    id: card.id,
    cardCode: card.cardCode,
    slug: card.slug,
    status: card.status,
    plan: card.plan,
    businessName: card.profile?.businessName ?? '',
    category: card.profile?.category ?? null,
    logoUrl: card.profile?.logoUrl ?? null,
    notes: card.notes,
    /** Once live, a slug change keeps the old address forwarding here. */
    slugForwards: card.firstActivatedAt !== null,
    firstActivatedAt: card.firstActivatedAt,
    archivedAt: card.archivedAt,
    ownerAccess: {
      enabled: card.ownerAccess,
      active: ownerAccessActive(card),
      codeSetAt: card.ownerCodeSetAt,
      lastEditAt: card.ownerLastEditAt,
    },
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    visitCount,
  };
}

const item = (i: SectionItem) => ({
  id: i.id,
  title: i.title,
  description: i.description,
  price: i.price,
  imageUrl: i.imageUrl,
  linkUrl: i.linkUrl,
  linkLabel: i.linkLabel,
  badge: i.badge,
  startsAt: i.startsAt,
  endsAt: i.endsAt,
  enabled: i.enabled,
});

const section = (s: CardSection) => ({
  id: s.id,
  type: s.type,
  title: s.title,
  enabled: s.enabled,
  items: [...(s.items ?? [])].sort(byPosition).map(item),
});

const button = (b: CardButton) => ({
  id: b.id,
  label: b.label,
  url: b.url,
  icon: b.icon,
  enabled: b.enabled,
  highlighted: b.highlighted,
});

const social = (l: SocialLink) => ({
  id: l.id,
  platform: l.platform,
  url: l.url,
  label: l.label,
  enabled: l.enabled,
});

/** Everything the admin editor needs, including disabled content. */
export function toCardDetail(
  card: NfcCard,
  visitCount = 0,
  oldSlugs: string[] = [],
) {
  const p = card.profile;
  return {
    ...toCardSummary(card, visitCount),
    /** Previous addresses that forward to this card. */
    oldSlugs,
    profile: {
      businessName: p.businessName,
      tagline: p.tagline,
      description: p.description,
      category: p.category,
      logoUrl: p.logoUrl,
      coverUrl: p.coverUrl,
      phone: p.phone,
      phoneLabel: p.phoneLabel,
      extraPhones: p.extraPhones ?? [],
      whatsapp: p.whatsapp,
      email: p.email,
      website: p.website,
      address: p.address,
      mapsUrl: p.mapsUrl,
      reviewsUrl: p.reviewsUrl,
      openingHours: p.openingHours,
      hoursNote: p.hoursNote,
      theme: p.theme,
      tapAction: p.tapAction,
    },
    sections: [...(card.sections ?? [])].sort(byPosition).map(section),
    buttons: [...(card.buttons ?? [])].sort(byPosition).map(button),
    socialLinks: [...(card.socialLinks ?? [])].sort(byPosition).map(social),
  };
}

export type CardDetail = ReturnType<typeof toCardDetail>;

/**
 * What a card's owner sees in their self-service editor: only the parts
 * they may change, plus enough context to show which card it is.
 */
export function toOwnerView(card: NfcCard) {
  return {
    slug: card.slug,
    businessName: card.profile?.businessName ?? '',
    plan: card.plan,
    lastEditAt: card.ownerLastEditAt,
    buttons: [...(card.buttons ?? [])].sort(byPosition).map(button),
    socialLinks: [...(card.socialLinks ?? [])].sort(byPosition).map(social),
  };
}

export type OwnerView = ReturnType<typeof toOwnerView>;
