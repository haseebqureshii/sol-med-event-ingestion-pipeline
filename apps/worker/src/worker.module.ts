import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerService } from './worker.service';
import { IngestionEvent } from '../../sol-ingestion-pipeline/src/entities/ingestion-event.entity';
import { ProcessedRecord } from '../../sol-ingestion-pipeline/src/entities/processed-record.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Enables the tracking of @Cron decorators for automated cleanup jobs
    ScheduleModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'postgres',
      // Uses Render's production database connection string if it exists, otherwise falls back to local dev
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_URL ? undefined : 'localhost',
      port: process.env.DATABASE_URL ? undefined : 5433,
      username: process.env.DATABASE_URL ? undefined : 'solace_user',
      password: process.env.DATABASE_URL ? undefined : 'supersecretpassword',
      database: process.env.DATABASE_URL ? undefined : 'ingestion_db',
      entities: [IngestionEvent, ProcessedRecord],
      synchronize: true, // Note: For true production architectures, migrations are preferred
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // Render Postgres requires SSL
    }),
    TypeOrmModule.forFeature([IngestionEvent, ProcessedRecord]),

    BullModule.forRoot({
      connection: {
        // Leverages Render's environmental variables for Redis connections in staging/production
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_URL ? {} : undefined, // Render Redis requires TLS/SSL encryption
      },
    }),
    BullModule.registerQueue({
      name: 'ingestionQueue',
    }),
  ],
  controllers: [],
  providers: [WorkerService],
})
export class WorkerModule {}