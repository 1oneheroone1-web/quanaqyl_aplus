import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';

// A shell-provided DATABASE_URL takes precedence over local ignored env files.
for (const filename of ['.env.local', '.env']) {
  try { loadEnvFile(new URL('../' + filename, import.meta.url)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running pnpm db:migrate');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  // Serialize parallel deployment jobs against this database.
  await client.query('SELECT pg_advisory_xact_lock(717001042)');
  await client.query(`CREATE TABLE IF NOT EXISTS _quanaqyl_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const name of ['db/auth.sql', 'db/postgres.sql']) {
    // Windows Git checkouts may use CRLF while Vercel uses LF. The same migration
    // must retain its checksum across those checkouts.
    const source = (await readFile(new URL('../' + name, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    const checksum = createHash('sha256').update(source).digest('hex');
    const previous = await client.query('SELECT checksum FROM _quanaqyl_migrations WHERE name=$1', [name]);
    if (previous.rows[0]) {
      if (previous.rows[0].checksum !== checksum) throw new Error(`${name} changed after it was applied; add a new migration instead`);
      console.log(`${name}: already applied`);
      continue;
    }
    await client.query(source);
    await client.query('INSERT INTO _quanaqyl_migrations (name,checksum) VALUES ($1,$2)', [name, checksum]);
    console.log(`${name}: applied`);
  }
  await client.query('COMMIT');
  console.log('PostgreSQL migrations complete');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  client?.release();
  await pool.end();
}
