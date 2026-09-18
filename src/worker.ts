import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  Logger.log('Worker ready (no queue processors registered yet — see ticket 07).', 'Worker');
  await app.init();
}

void bootstrap();
