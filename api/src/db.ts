// api/src/db.ts
import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer VERDANTOPS_DB_URL, fallback to DATABASE_URL
const connectionString =
  process.env.VERDANTOPS_DB_URL ?? process.env.DATABASE_URL ?? '';

if (!connectionString) {
  throw new Error('Missing VERDANTOPS_DB_URL or DATABASE_URL in environment.');
}

export const pool = new Pool({
  connectionString,
  // Optional: enable SSL in prod (adjust to your infra)
  ssl:
    process.env.PGSSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});

/** Basic health check */
export async function ping(): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}

/**
 * Apply all .sql files in /migrations in lexical order.
 * Looks at api/migrations by default, override with MIGRATIONS_DIR.
 */
export async function migrate(): Promise<void> {
  const migrationsDir =
    process.env.MIGRATIONS_DIR ??
    // dist build: ../migrations (next to compiled src)
    path.resolve(__dirname, '../migrations');

  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.warn(`[migrate] No .sql files found in ${migrationsDir}`);
    return;
  }

  // Run each migration in its own transaction
  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const name = path.basename(file);
    const sql = await readFile(full, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] failed ${name}`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
