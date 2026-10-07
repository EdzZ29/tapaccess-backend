import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { NfcCard } from './nfc-card.entity';

@Entity('card_buttons')
@Index(['cardId', 'position'])
export class CardButton {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => NfcCard, (card) => card.buttons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @Column({ type: 'varchar', length: 60 })
  label!: string;

  /** http(s), tel:, mailto: or sms:, validated on write. */
  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'varchar', length: 32, default: 'link' })
  icon!: string;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** Rendered with the accent colour to draw attention. */
  @Column({ type: 'boolean', default: false })
  highlighted!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
