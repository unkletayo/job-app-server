import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // job-app-ui (ADR 0006) runs as a separate Vite dev server, so the browser
  // sends cross-origin requests here — CORS is only relevant to the browser
  // path, not the e2e suite, which calls the app directly via supertest.
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
