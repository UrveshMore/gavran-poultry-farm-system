import { pool } from '../src/db/pool.js';

export async function teardown(): Promise<void> {
  await pool.end();
}
