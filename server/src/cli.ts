import { env } from './config/env.js';
import { migrate, rollback } from './db/migrate.js';
import { pool } from './db/pool.js';
import { findUserByEmail, insertUser } from './modules/auth/repository.js';
import { hashPassword } from './security/password.js';

const command = process.argv[2];

try {
  if (command === 'migrate') {
    const applied = await migrate();
    console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Migrations already up to date.');
  } else if (command === 'rollback') {
    const version = await rollback();
    console.log(`Rolled back ${version}.`);
  } else if (command === 'seed') {
    if (env.NODE_ENV === 'production' || !env.SEED_DEV) {
      throw new Error('Refusing to seed. Set SEED_DEV=true and do not use NODE_ENV=production.');
    }
    const existing = await findUserByEmail(pool, env.SEED_OWNER_EMAIL.toLowerCase());
    if (existing) {
      console.log(`Seed user already exists: ${existing.email}`);
    } else {
      await insertUser(pool, {
        email: env.SEED_OWNER_EMAIL.toLowerCase(),
        displayName: env.SEED_OWNER_NAME,
        passwordHash: await hashPassword(env.SEED_OWNER_PASSWORD),
        preferredLocale: 'en',
      });
      console.log(`Created local user ${env.SEED_OWNER_EMAIL}. Password is SEED_OWNER_PASSWORD from the environment.`);
    }
  } else {
    throw new Error('Usage: tsx src/cli.ts <migrate|rollback|seed>');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
