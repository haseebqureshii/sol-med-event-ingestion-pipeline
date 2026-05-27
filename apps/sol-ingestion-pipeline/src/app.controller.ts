import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionEvent, IngestionStatus } from './entities/ingestion-event.entity';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { Controller, Get, Post, Body, HttpCode, HttpStatus, Logger, HttpException } from '@nestjs/common';

@Controller('webhooks')
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    @InjectQueue('ingestionQueue') private readonly ingestionQueue: Queue,
    @InjectRepository(IngestionEvent) private readonly ingestionEventRepo: Repository<IngestionEvent>,
  ) {}

  @Post('records')
  @HttpCode(HttpStatus.ACCEPTED)
  async receiveMedicalRecord(@Body() payload: WebhookPayloadDto) {
    this.logger.log(`Received payload from provider: ${payload.providerEventId}`);

    try {
      const ingestionEvent = this.ingestionEventRepo.create({
        providerEventId: payload.providerEventId,
        patientId: payload.patientId,
        status: IngestionStatus.PENDING,
      });
      const savedEvent = await this.ingestionEventRepo.save(ingestionEvent);

      await this.ingestionQueue.add('process-record', {
        internalEventId: savedEvent.id,
        ...payload,
      }, {
        attempts: 3, // If it fails, try 2 more times
        backoff: {
          type: 'exponential',
          delay: 1000, // Wait 1s, then 2s, then 4s between retries
        }
      });

      return {
        message: 'Payload received and queued for asynchronous processing.',
        trackingId: savedEvent.id,
        status: 'PENDING'
      };

    } catch (error) {
      if (error.code === '23505') {
        throw new HttpException(
          `Payload with providerEventId '${payload.providerEventId}' has already been received.`, 
          HttpStatus.CONFLICT
        );
      }
      // If it's a different error, throw a generic 500
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('metrics')
  async getQueueMetrics() {
    // Queries the database to get exact counts of every status
    const pendingCount = await this.ingestionEventRepo!.count({ where: { status: IngestionStatus.PENDING } });
    const processingCount = await this.ingestionEventRepo!.count({ where: { status: IngestionStatus.PROCESSING } });
    const completedCount = await this.ingestionEventRepo!.count({ where: { status: IngestionStatus.COMPLETED } });
    const failedCount = await this.ingestionEventRepo!.count({ where: { status: IngestionStatus.FAILED } });

    return {
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
      failed: failedCount,
      total: pendingCount + processingCount + completedCount + failedCount,
    };
  }
}