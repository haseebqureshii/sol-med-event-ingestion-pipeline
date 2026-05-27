import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  
  // createApplicationContext initializes the Nest app without an HTTP listener
  const app = await NestFactory.createApplicationContext(WorkerModule);
  
  await app.init();
  logger.log('Background Worker Process successfully initialized and listening to Redis queue.');
}
bootstrap();