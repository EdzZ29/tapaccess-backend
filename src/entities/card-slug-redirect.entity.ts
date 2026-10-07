import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { NfcCard } from './nfc-card.entity';

/**
 * A card's previous address. When an activated card's slug changes, NFC tags
 * and QR codes written with the old address keep working: it forwards to the
 * card's current slug. An old address stays reserved for its card, so it
 * can never start showing a different business.
 */
@Entity('card_slug_redirects')
export class CardSlugRedirect {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  slug!: string;

  @Index()
  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => NfcCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
