import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('processed_records')
export class ProcessedRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ingestionEventId: string; // Link back to the original webhook receipt

  @Column()
  patientId: string;

  @Column()
  documentType: string; // e.g., "LabResult", "ProgressNote", "DischargeSummary"

  @Column()
  encryptedStorageRef: string; // Path or key to where the encrypted file is saved

  @CreateDateColumn()
  processedAt: Date;
}