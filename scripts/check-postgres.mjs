import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import ts from 'typescript';

// Integration test against REAL PostgreSQL, including concurrent transactions.
// All test tables live in a fresh random schema, which is removed in finally.
// DATABASE_URL must allow CREATE SCHEMA; no existing schema/data is modified.
for (const filename of ['.env.local', '.env']) {
  try { loadEnvFile(new URL('../' + filename, import.meta.url)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the PostgreSQL integration test');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'quanaqyl-postgres-'));
const schema = 'qa_test_' + randomUUID().replaceAll('-', '');
assert.match(schema, /^qa_test_[a-f0-9]{32}$/);
const admin = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, options: '-c search_path=' + schema });
const compiled = new Map();
let created = false;
async function compile(name) {
  if (compiled.has(name)) return compiled.get(name);
  const destination = join(directory, name + '.mjs');
  compiled.set(name, destination);
  const isJson = name.endsWith('.json'), filename = isJson ? name : name + '.ts';
  const source = await readFile(join(root, filename), 'utf8');
  let output = isJson ? `export default ${source};` : ts.transpileModule(source, {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const match of [...output.matchAll(/from\s+(['"])(@\/[^'"]+|\.{1,2}\/[^'"]+)\1/g)]) {
    const dependency = match[2].startsWith('@/') ? match[2].slice(2) : relative(root, resolve(root, dirname(name), match[2]));
    output = output.replace(match[0], `from ${JSON.stringify(pathToFileURL(await compile(dependency)).href)}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, output);
  return destination;
}
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await pool.query(await readFile(join(root, 'db/postgres.sql'), 'utf8'));
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const load = async name => import(pathToFileURL(await compile(name)).href);
  const { createDatabase, postgresSql } = await load('lib/database');
  const { purchaseProduct, getShopState } = await load('lib/shop-server');
  const { shopProducts } = await load('lib/shop');
  const { commandFocus, getFocusState } = await load('lib/focus-server');
  const db = createDatabase(pool), now = Date.now();

  const sql = `SELECT ?::bigint AS createdAt, '? literal' AS note, $$dollar ?$$ AS dollar,
    ?::integer AS quantity -- ignored ?
    /* outer ? /* nested ? */ comment */`;
  assert.equal(postgresSql(sql).parameters, 2);
  const row = await db.prepare(sql).bind(now, 3).first();
  assert.deepEqual(row, { createdAt: now, note: '? literal', dollar: 'dollar ?', quantity: 3 });
  const reusable = db.prepare('SELECT ?::integer AS value');
  assert.equal((await reusable.bind(1).first()).value, 1);
  assert.equal((await reusable.bind(2).first()).value, 2);
  await assert.rejects(db.prepare('SELECT ?::integer').all(), /parameter count/);

  await assert.rejects(db.batch([
    db.prepare('INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?)').bind('rollback-profile', '{}', now),
    db.prepare('INSERT INTO photos (user_id,content_type,bytes,updated_at) VALUES (?,?,?,?)')
      .bind('rollback-profile', 'image/png', Buffer.alloc(0), now),
  ]));
  assert.equal(await db.prepare('SELECT user_id FROM profiles WHERE user_id=?').bind('rollback-profile').first(), null);

  const product = shopProducts.reduce((best, item) => item.price < best.price ? item : best);
  await db.prepare('INSERT INTO awards (user_id,key,amount,created_at) VALUES (?,?,?,?)').bind('buyer', 'seed', product.price, now).run();
  const purchase = () => ({ requestId: randomUUID(), productId: product.id, quantity: 1 });
  const competing = await Promise.allSettled([purchaseProduct(db, 'buyer', purchase()), purchaseProduct(db, 'buyer', purchase())]);
  assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1, 'only one buyer may spend the available balance');
  const rejected = competing.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.message, 'shopInsufficient');
  const wallet = await getShopState(db, 'buyer');
  assert.equal(wallet.balance, 0);
  assert.equal(wallet.earned, product.price);
  assert.equal(wallet.purchases[0].unitPrice, product.price);
  assert.equal(typeof wallet.purchases[0].createdAt, 'number');
  assert.equal((await getShopState(db, 'other-user')).inventory.length, 0);
  await db.prepare('INSERT INTO awards (user_id,key,amount,created_at) VALUES (?,?,?,?)').bind('retry-buyer', 'seed', product.price, now).run();
  const same = purchase();
  await Promise.all([purchaseProduct(db, 'retry-buyer', same), purchaseProduct(db, 'retry-buyer', same)]);
  assert.equal((await getShopState(db, 'retry-buyer')).purchases.length, 1, 'retry must not spend twice');

  const pauseSql = `INSERT INTO pauses (user_id,id,start) SELECT ?,?,?
    WHERE NOT EXISTS (SELECT 1 FROM pauses WHERE user_id=? AND "end" IS NULL)
    AND (SELECT COUNT(*) FROM pauses WHERE user_id=? AND start>=?)<5`;
  const pause = () => db.prepare(pauseSql).bind('pause-user', randomUUID(), now, 'pause-user', 'pause-user', now - 1).run();
  const pauses = await Promise.all([pause(), pause()]);
  assert.equal(pauses.reduce((count, result) => count + result.meta.changes, 0), 1, 'concurrent requests create one active pause');
  await db.prepare('UPDATE pauses SET "end"=? WHERE user_id=?').bind(now, 'pause-user').run();
  for (let i = 0; i < 3; i++) {
    await db.prepare('INSERT INTO pauses (user_id,id,start,"end") VALUES (?,?,?,?)').bind('pause-user', randomUUID(), now, now).run();
  }
  const monthly = await Promise.all([pause(), pause()]);
  assert.equal(monthly.reduce((count, result) => count + result.meta.changes, 0), 1, 'monthly pause allowance cannot be exceeded concurrently');

  const start = { action: 'start', revision: 0, requestId: randomUUID(), workMinutes: 1, breakMinutes: 1 };
  const starts = await Promise.allSettled([
    commandFocus(db, 'focus-user', start, now),
    commandFocus(db, 'focus-user', { ...start, requestId: randomUUID() }, now),
  ]);
  assert.equal(starts.filter(result => result.status === 'fulfilled').length, 1, 'one focus CAS wins');
  const running = await getFocusState(db, 'focus-user', now);
  const sync = { action: 'sync', revision: running.timer.revision, requestId: randomUUID() };
  const completions = await Promise.allSettled([
    commandFocus(db, 'focus-user', sync, now + 60_000),
    commandFocus(db, 'focus-user', { ...sync, requestId: randomUUID() }, now + 60_000),
  ]);
  assert.equal(completions.filter(result => result.status === 'fulfilled').length, 1);
  const completed = await getFocusState(db, 'focus-user', now + 60_000);
  assert.equal(completed.sessions.length, 1);
  assert.equal(completed.sessions[0].focusMs, 60_000);
  assert.equal(completed.sessions[0].startedAt, now);
  assert.equal((await getFocusState(db, 'unrelated-user', now)).sessions.length, 0);

  await commandFocus(db, 'rollback-focus', { ...start, requestId: randomUUID() }, now);
  const failingDatabase = { ...db, batch(statements) {
    return db.batch([...statements, db.prepare('INSERT INTO photos (user_id,content_type,bytes,updated_at) VALUES (?,?,?,?)')
      .bind('invalid-photo', 'image/png', Buffer.alloc(0), now)]);
  } };
  await assert.rejects(commandFocus(failingDatabase, 'rollback-focus', { ...sync, revision: 1, requestId: randomUUID() }, now + 60_000));
  const rolledBack = await getFocusState(db, 'rollback-focus', now + 60_000);
  assert.equal(rolledBack.timer.revision, 1);
  assert.equal(rolledBack.timer.phase, 'work');
  assert.equal(rolledBack.sessions.length, 0, 'timer and history roll back together');

  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  await db.prepare('INSERT INTO photos (user_id,content_type,bytes,updated_at) VALUES (?,?,?,?)').bind('photo-user', 'image/png', bytes, now).run();
  assert.deepEqual((await db.prepare('SELECT bytes FROM photos WHERE user_id=?').bind('photo-user').first()).bytes, bytes);
  assert.equal(await db.prepare('SELECT bytes FROM photos WHERE user_id=?').bind('other-user').first(), null);
  await assert.rejects(db.prepare('INSERT INTO photos (user_id,content_type,bytes,updated_at) VALUES (?,?,?,?)')
    .bind('oversized-photo', 'image/png', Buffer.alloc(2_097_153), now).run());
  console.log('PostgreSQL integration PASS: SQL translation, numeric types, atomic rollback, concurrent purchases/pauses/focus and private photo storage');
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
