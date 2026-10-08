import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { NfcCard } from './nfc-card.entity';

/**
 * The card owner's review of TapAccess, shown with their business in
 * "Businesses on TapAccess" on the homepage. One per card.
 *
 * Only the owner can leave it: the admin makes a private review link and
 * sends it to them. The link's token is stored only as a SHA-256 hash, so it
 * is shown once; a new link replaces the old one. The owner can come back
 * with the same link to update their review.
 */
@Entity('card_reviews')
export class CardReview {
  @PrimaryColumn({ type: 'uuid' })
  cardId!: string;

  @OneToOne(() => NfcCard, (card) => card.review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  /** SHA-256 (hex) of the review link's token; null when the link is off. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  tokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  linkCreatedAt!: Date | null;

  /** 1–5 stars; null until the owner submits. */
  @Column({ type: 'smallint', nullable: true })
  rating!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  authorName!: string | null;

  /** e.g. "Owner" or "Manager". */
  @Column({ type: 'varchar', length: 80, nullable: true })
  authorRole!: string | null;

  /** Admin moderation: kept, but left off the homepage. */
  @Column({ type: 'boolean', default: false })
  hidden!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
