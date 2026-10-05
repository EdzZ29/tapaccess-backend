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
import { CardButton } from './card-button.entity';
import { ClickKind } from './enums';
import { NfcCard } from './nfc-card.entity';

/**
 * A tap on any actionable element of a public profile. Custom buttons are
 * linked by `buttonId`; built-in actions (call, email, socials, save contact)
 * are identified by `kind` + `target`. `label` is a snapshot so history stays
 * readable after a button is renamed or deleted.
 */
@Entity('button_clicks')
@Index(['cardId', 'clickedAt'])
export class ButtonClick {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => NfcCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  buttonId!: string | null;

  @ManyToOne(() => CardButton, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'button_id' })
  button!: Relation<CardButton> | null;

  @Column({ type: 'enum', enum: ClickKind, enumName: 'click_kind' })
  kind!: ClickKind;

  /** e.g. `phone`, `email`, `vcard`, `instagram`, or the button id. */
  @Column({ type: 'varchar', length: 64 })
  target!: string;

  @Column({ type: 'varchar', length: 80 })
  label!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  clickedAt!: Date;

  @Column({ type: 'char', length: 32 })
  visitorHash!: string;
}
