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
import { CardSection } from './card-section.entity';

/** A service, product, promotion, gallery photo or announcement. */
@Entity('section_items')
@Index(['sectionId', 'position'])
export class SectionItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sectionId!: string;

  @ManyToOne(() => CardSection, (section) => section.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section!: Relation<CardSection>;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Free-form so admins can write "From $25" or "₱1,200". */
  @Column({ type: 'varchar', length: 40, nullable: true })
  price!: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  linkUrl!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  linkLabel!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  badge!: string | null;

  /** Promotions/announcements are hidden publicly outside this window. */
  @Column({ type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
