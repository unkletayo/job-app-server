import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { ResponseEnvelopeFilter } from './common/filters/response-envelope.filter';

/** Shared app-wide wiring — used by both main.ts and the e2e test bootstrap, so they can't drift apart. */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new ResponseEnvelopeFilter());
}
