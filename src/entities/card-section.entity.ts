import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { SectionType } from './enums';
import { NfcCard } from './nfc-card.entity';
import { SectionItem } from './section-item.entity';

@Entity('card_sections')
@Index(['cardId', 'type'], { unique: true })
export class CardSection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cardId!: string;

  @ManyToOne(() => NfcCard, (card) => card.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Relation<NfcCard>;

  @Column({ type: 'enum', enum: SectionType, enumName: 'section_type' })
  type!: SectionType;

  /** Optional heading override; the frontend falls back to a default per type. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  title!: string | null;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @OneToMany(() => SectionItem, (item) => item.section)
  items!: Relation<SectionItem[]>;
}
