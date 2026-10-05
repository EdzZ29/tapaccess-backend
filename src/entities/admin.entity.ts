import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminRole } from './enums';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Always stored lower-cased. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: AdminRole,
    enumName: 'admin_role',
    default: AdminRole.SuperAdmin,
  })
  role!: AdminRole;

  /** Incremented on password change to invalidate every issued session. */
  @Column({ type: 'int', default: 0 })
  tokenVersion!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
