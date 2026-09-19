import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

function toTestDatabaseUrl(url: string): string {
  return url.replace(/\/([^/?]+)(\?.*)?$/, '/job_app_test$2');
}

// A separate Redis logical database (index 1, not the default 0) so
// discovery-queue e2e tests never share BullMQ state with local dev.
function toTestRedisUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = '/1';
  return parsed.toString();
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = toTestDatabaseUrl(process.env.DATABASE_URL);
}

if (process.env.REDIS_URL) {
  process.env.REDIS_URL = toTestRedisUrl(process.env.REDIS_URL);
}
