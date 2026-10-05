import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { TapAction } from './enums';
import { NfcCard } from './nfc-card.entity';
import type { OpeningHoursDay, ThemeConfig } from './profile-types';

@Entity('card_profiles')
export class CardProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Uniqueness comes from the one-to-one join column constraint.
  @Column({ type: 'uuid' })
  cardId!: string;

  @OneToOne(() => NfcCard, (card) => card.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  businessName!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  tagline!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  whatsapp!: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  mapsUrl!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  reviewsUrl!: string | null;

  @Column({ type: 'jsonb' })
  openingHours!: OpeningHoursDay[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  hoursNote!: string | null;

  @Column({ type: 'jsonb' })
  theme!: ThemeConfig;

  @Column({
    type: 'enum',
    enum: TapAction,
    enumName: 'tap_action',
    default: TapAction.Profile,
  })
  tapAction!: TapAction;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
