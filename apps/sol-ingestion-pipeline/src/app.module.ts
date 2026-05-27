import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule'; // Required for your DB cleanup
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionEvent } from './entities/ingestion-event.entity';
import { ProcessedRecord } from './entities/processed-record.entity';

// Import your worker logic directly into the API gateway
import { WorkerService } from '../../worker/src/worker.service'; 

@Module({
  imports: [
    // Initializes the 10-minute aggressive memory cleanup
    ScheduleModule.forRoot(), 

    // 1. Database Connection Configuration (Supabase Pooler)
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_URL ? undefined : 'localhost',
      port: process.env.DATABASE_URL ? undefined : 5433,
      username: process.env.DATABASE_URL ? undefined : 'solace_user',
      password: process.env.DATABASE_URL ? undefined : 'supersecretpassword',
      database: process.env.DATABASE_URL ? undefined : 'ingestion_db',
      entities: [IngestionEvent, ProcessedRecord],
      synchronize: true, 
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature([IngestionEvent, ProcessedRecord]),
    
    // 2. Redis Connection Configuration (Upstash)
    BullModule.forRoot({
      connection: (() => {
        if (process.env.REDIS_URL) {
          const url = new URL(process.env.REDIS_URL);
          return {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: {}, 
          };
        }
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
  controllers: [AppController],
  
  // 3. The Worker is now alive inside the Gatekeeper!
  providers: [AppService, WorkerService], 
})
export class AppModule {}