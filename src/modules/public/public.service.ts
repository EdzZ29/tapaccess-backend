import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import type { AppConfig } from '../../config/env';
import { CardSlugRedirect, CardStatus, NfcCard } from '../../entities';
import { MediaService } from '../media/media.service';
import { toPublicProfile } from './public-profile.mapper';
import { buildVCard, vCardDisposition } from './vcard';

@Injectable()
export class PublicService {
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(NfcCard) private readonly cards: Repository<NfcCard>,
    @InjectRepository(CardSlugRedirect)
    private readonly redirects: Repository<CardSlugRedirect>,
    private readonly media: MediaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.frontendUrl = config
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/$/, '');
  }

  /**
   * 404 when the slug was never issued; 403 `CARD_UNAVAILABLE` when it
   * exists but is inactive or archived, so the page can say "temporarily
   * unavailable" rather than "not found". Nothing else about an unavailable
   * card is revealed. An old address of a card answers `{ movedTo }` with the
   * card's current slug, so NFC tags written before a rename keep working.
   */
  async getProfile(slug: string) {
    const card = await this.findCard(slug);
    if (!card) {
      const moved = await this.currentSlugFor(slug);
      if (moved) return { movedTo: moved };
    }
    return this.toProfile(card);
  }

  /** The current slug an old address forwards to, if any. */
  private async currentSlugFor(oldSlug: string): Promise<string | null> {
    const redirect = await this.redirects.findOne({
      where: { slug: oldSlug },
      relations: { card: true },
    });
    return redirect?.card?.slug ?? null;
  }

  private findCard(slug: string) {
    return this.cards.findOne({
      where: { slug },
      relations: {
        profile: true,
        sections: { items: true },
        buttons: true,
        socialLinks: true,
      },
    });
  }

  private toProfile(card: NfcCard | null) {
    if (!card)
      throw new NotFoundException({
        message: 'Card not found',
        code: 'CARD_NOT_FOUND',
      });
    if (card.status !== CardStatus.Active) {
      throw new ForbiddenException({
        message: 'This card is currently unavailable',
        code: 'CARD_UNAVAILABLE',
      });
    }
    return toPublicProfile(card);
  }

  /** `siteUrl`: the address the visitor used, so the card link in the vCard always matches it. */
  async getVCard(
    slug: string,
    siteUrl?: string,
  ): Promise<{ disposition: string; body: string }> {
    // Old addresses work here too (Save contact from an old link or tag).
    const card =
      (await this.findCard(slug)) ??
      (await this.findCard((await this.currentSlugFor(slug)) ?? slug));
    const profile = this.toProfile(card);
    let photo: Buffer | null = null;
    if (profile.logoUrl) {
      // Contacts apps want a small JPEG; our stored logos are WebP.
      const original = await this.media
        .readByUrl(profile.logoUrl)
        .catch(() => null);
      if (original) {
        photo = await sharp(original)
          .resize(256, 256, { fit: 'cover' })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 80 })
          .toBuffer()
          .catch(() => null);
      }
    }
    return {
      disposition: vCardDisposition(profile.businessName),
      body: buildVCard(
        profile,
        `${siteUrl ?? this.frontendUrl}/c/${profile.slug}`,
        photo,
      ),
    };
  }
}
