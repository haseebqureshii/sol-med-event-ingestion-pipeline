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
      connection: (() => {
        if (process.env.REDIS_URL) {
          // Parse the production Upstash 'rediss://default:password@host:port' URL
          const url = new URL(process.env.REDIS_URL);
          return {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: {}, // Forces SSL/TLS which Upstash requires
          };
        }
        // Fall back to clean, simple local connection object
        return {
          host: 'localhost',
          port: 6379,
        };
      })(),
    }),
    BullModule.registerQueue({
      name: 'ingestionQueue',
    }),
  ],
  controllers: [],
  providers: [WorkerService],
})
export class WorkerModule {}