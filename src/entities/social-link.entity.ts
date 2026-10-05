import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { SocialPlatform } from './enums';
import { NfcCard } from './nfc-card.entity';

@Entity('social_links')
@Index(['cardId', 'position'])
export class SocialLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => NfcCard, (card) => card.socialLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @Column({ type: 'enum', enum: SocialPlatform, enumName: 'social_platform' })
  platform!: SocialPlatform;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  /** Only used for `other`, where there is no recognisable brand name. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  label!: string | null;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}
