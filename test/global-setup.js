// Not transformed by ts-jest — Jest loads globalSetup via plain require(), so
// this stays CommonJS rather than TypeScript.
const { config } = require('dotenv');
const { resolve } = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

function toDatabaseUrl(url, databaseName) {
  return url.replace(/\/([^/?]+)(\?.*)?$/, `/${databaseName}$2`);
}

module.exports = async function globalSetup() {
  config({ path: resolve(__dirname, '..', '.env') });

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error('DATABASE_URL must be set (see .env.example) before running e2e tests.');
  }

  const testUrl = toDatabaseUrl(devUrl, 'job_app_test');
  const maintenanceUrl = toDatabaseUrl(devUrl, 'postgres');
  const testDbName = new URL(testUrl).pathname.replace(/^\//, '');

  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      testDbName,
    ]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${testDbName}"`);
    }
  } finally {
    await client.end();
  }

  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
};
