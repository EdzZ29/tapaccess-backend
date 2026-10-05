import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { CardButton } from './card-button.entity';
import { CardProfile } from './card-profile.entity';
import { CardSection } from './card-section.entity';
import { CardPlan, CardStatus } from './enums';
import { SocialLink } from './social-link.entity';

/**
 * The physical card record. Holds admin-only metadata; everything shown on
 * the public page lives on the related profile, sections, buttons and links.
 */
@Entity('nfc_cards')
export class NfcCard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Internal card ID printed on / tracked with the physical card, e.g. TA-000042. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  cardCode!: string;

  /** Permanent public slug written to the NFC tag. Locked after first activation. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CardStatus,
    enumName: 'card_status',
    default: CardStatus.Inactive,
  })
  status!: CardStatus;

  /** See `common/plans.ts` for what each package unlocks. */
  @Index()
  @Column({
    type: 'enum',
    enum: CardPlan,
    enumName: 'card_plan',
    default: CardPlan.Business,
  })
  plan!: CardPlan;

  /** Internal admin notes. Never exposed publicly. */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  firstActivatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => CardProfile, (profile) => profile.card)
  profile!: Relation<CardProfile>;

  @OneToMany(() => CardSection, (section) => section.card)
  sections!: Relation<CardSection[]>;

  @OneToMany(() => CardButton, (button) => button.card)
  buttons!: Relation<CardButton[]>;

  @OneToMany(() => SocialLink, (link) => link.card)
  socialLinks!: Relation<SocialLink[]>;

  /** Populated by `loadRelationCountAndMap` in list queries. */
  visitCount?: number;
}
