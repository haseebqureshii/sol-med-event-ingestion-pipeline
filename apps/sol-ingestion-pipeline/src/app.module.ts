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
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_URL ? undefined : 'localhost',
      port: process.env.DATABASE_URL ? undefined : 5433,
      username: process.env.DATABASE_URL ? undefined : 'solace_user',
      password: process.env.DATABASE_URL ? undefined : 'supersecretpassword',
      database: process.env.DATABASE_URL ? undefined : 'ingestion_db',
      entities: [IngestionEvent, ProcessedRecord],
      synchronize: true, 
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // Supabase requires SSL
    }),
    // 2. Register entities to make repositories available in this module
    TypeOrmModule.forFeature([IngestionEvent, ProcessedRecord]),
    
    BullModule.forRoot({
      connection: (() => {
        if (process.env.REDIS_URL) {
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