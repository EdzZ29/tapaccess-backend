import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { DeviceType } from './enums';
import { NfcCard } from './nfc-card.entity';

/**
 * One counted profile view. Deliberately minimal: no IP address, no full
 * user agent, no location. `visitorHash` is a salted hash that rotates daily,
 * so it can de-duplicate refreshes but cannot follow a visitor across days.
 */
@Entity('card_visits')
@Index(['cardId', 'visitedAt'])
export class CardVisit {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => NfcCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @CreateDateColumn({ type: 'timestamptz' })
  visitedAt!: Date;

  @Column({ type: 'char', length: 32 })
  visitorHash!: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
    enumName: 'device_type',
    default: DeviceType.Unknown,
  })
  deviceType!: DeviceType;

  /** Hostname only (e.g. `instagram.com`), never the full referring URL. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  referrerHost!: string | null;
}
