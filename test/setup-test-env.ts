import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

function toTestDatabaseUrl(url: string): string {
  return url.replace(/\/([^/?]+)(\?.*)?$/, '/job_app_test$2');
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = toTestDatabaseUrl(process.env.DATABASE_URL);
}
