import { createApp } from './app.js';
import { env } from './config/env.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { logger } from './logger.js';

try {
  const applied = await migrate();
  if (applied.length > 0) logger.info({ applied }, 'applied migrations');
} catch (error) {
  logger.error({ err: error }, 'database startup failed');
  console.error(`\nCould not reach MySQL at ${env.DB_HOST}:${env.DB_PORT} (${env.DB_NAME}).`);
  console.error('Start it with: npm run db:up\n');
  process.exit(1);
}

const app = createApp();
const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT }, 'api listening');
});

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
