import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionEvent } from './entities/ingestion-event.entity';
import { ProcessedRecord } from './entities/processed-record.entity';

@Module({
  imports: [
    // 1. Database Connection Configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5433,
      username: 'solace_user',
      password: 'supersecretpassword',
      database: 'ingestion_db',
      entities: [IngestionEvent, ProcessedRecord],
      synchronize: true, // Auto-creates/updates tables in development
    }),
    // 2. Register entities to make repositories available in this module
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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}