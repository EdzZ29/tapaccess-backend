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
import { MediaKind } from './enums';
import { NfcCard } from './nfc-card.entity';

/** Metadata for an uploaded, re-encoded image. The bytes live in object storage. */
@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  cardId!: string | null;

  @ManyToOne(() => NfcCard, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard> | null;

  @Column({
    type: 'enum',
    enum: MediaKind,
    enumName: 'media_kind',
    default: MediaKind.Other,
  })
  kind!: MediaKind;

  /** `local` or `supabase` — which storage driver holds the file. */
  @Column({ type: 'varchar', length: 16 })
  provider!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'varchar', length: 64 })
  mimeType!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
