export async function setup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '3307';
  process.env.DB_USER = 'gavran';
  process.env.DB_PASSWORD = 'gavran_local';
  process.env.DB_NAME = 'gavran_test';
  process.env.DB_ADMIN_USER = 'root';
  process.env.DB_ADMIN_PASSWORD = 'gavran_root_local';
  process.env.JWT_SECRET = 'test-only-jwt-secret-must-be-32chars';
  process.env.LOG_LEVEL = 'silent';

  const { ensureTestDatabase } = await import('../src/db/ensureDatabase.js');
  const { migrate } = await import('../src/db/migrate.js');

  let last: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await ensureTestDatabase();
      await migrate();
      return;
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw last;
}
