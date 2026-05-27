import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IngestionEvent, IngestionStatus } from '../../sol-ingestion-pipeline/src/entities/ingestion-event.entity';
import { ProcessedRecord } from '../../sol-ingestion-pipeline/src/entities/processed-record.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Processor('ingestionQueue', {
  concurrency: 5, // Process up to 5 medical records simultaneously
})
export class WorkerService extends WorkerHost {
  private readonly logger = new Logger(WorkerService.name);
  
  // Dummy key/iv for AES-256 simulation
  private readonly AES_KEY = crypto.randomBytes(32); 
  private readonly AES_IV = crypto.randomBytes(16);

  constructor(
    @InjectRepository(IngestionEvent) private readonly eventRepo: Repository<IngestionEvent>,
    @InjectRepository(ProcessedRecord) private readonly recordRepo: Repository<ProcessedRecord>,
  ) {
    super();
  }

  @Cron('*/10 * * * *')
  async handleCleanup() {
    this.logger.log('Executing aggressive 10-minute cleanup...');
    
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // We delete in a targeted way to avoid locking the whole table
    await this.eventRepo
      .createQueryBuilder()
      .delete()
      .from(IngestionEvent)
      .where("status = :status AND created_at < :date", { 
        status: IngestionStatus.COMPLETED, 
        date: tenMinutesAgo 
      })
      .execute();
      
    await this.eventRepo.query('VACUUM ANALYZE "ingestion_event"');
      
    this.logger.log('Aggressive cleanup finished.');
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[Job ${job.id}] Picked up payload from Redis...`);
    const { internalEventId, filePayload, patientId, documentType } = job.data;

    // 1. Mark as Processing
    await this.eventRepo.update(internalEventId, { status: IngestionStatus.PROCESSING });

    try {
      // 2. Simulate Heavy Workload: Encrypt the Base64 file
      if (filePayload === 'CORRUPT_POISON_PILL') {
        throw new Error('FATAL: Payload signature verification failed. File is corrupted.');
      }
      this.logger.log(`[Job ${job.id}] Encrypting PHI payload for ${patientId}...`);
      const encryptedData = this.encryptPayload(filePayload);
      
      // Simulate network delay of writing to an S3 bucket
      await new Promise((resolve) => setTimeout(resolve, 1500)); 

      // 3. Save the Processed Metadata
      const processedRecord = this.recordRepo.create({
        ingestionEventId: internalEventId,
        patientId,
        documentType,
        encryptedStorageRef: `s3://solace-secure-vault/records/${patientId}/${job.id}.enc`,
      });
      await this.recordRepo.save(processedRecord);

      // 4. Mark as Completed
      await this.eventRepo.update(internalEventId, { status: IngestionStatus.COMPLETED });
      this.logger.log(`[Job ${job.id}] Successfully processed and encrypted.`);
      
    } catch (error: any) {
      this.logger.error(`[Job ${job.id}] Processing failed: ${error.message}`);
      // If it fails, update the DB so the dashboard knows
      await this.eventRepo.update(internalEventId, { 
        status: IngestionStatus.FAILED,
        errorMessage: error.message 
      });
      throw error; // Throwing the error triggers BullMQ's retry/Dead Letter Queue logic
    }
  }

  private encryptPayload(data: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.AES_KEY, this.AES_IV);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
}