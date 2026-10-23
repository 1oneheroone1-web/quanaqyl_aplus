import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Run the REAL purchase service and generated SQL against a temporary SQLite DB.
// No production data, authentication, API requests or user balances are changed.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'quanaqyl-shop-'));
const compiled = new Map();
let sqlite;
async function compile(name) {
  if (compiled.has(name)) return compiled.get(name);
  const destination = join(directory, name + '.mjs');
  compiled.set(name, destination);
  const isJson = name.endsWith('.json');
  let filename = name;
  if (!isJson) {
    try { await readFile(join(root, name + '.tsx')); filename += '.tsx'; }
    catch { filename += '.ts'; }
  }
  const source = await readFile(join(root, filename), 'utf8');
  let output = isJson ? `export default ${source};` : ts.transpileModule(source, {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const match of [...output.matchAll(/from\s+(['"])(@\/[^'"]+|\.{1,2}\/[^'"]+)\1/g)]) {
    const dependency = match[2].startsWith('@/') ? match[2].slice(2) : relative(root, resolve(root, dirname(name), match[2]));
    output = output.replace(match[0], `from ${JSON.stringify(pathToFileURL(await compile(dependency)).href)}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, output);
  return destination;
}
// Same prepare/bind/first/run/batch calls as D1, using SQLite's actual SQL engine.
function adapter(connection) {
  return {
    prepare(query) {
      const statement = { args: [], bind(...args) { this.args = args; return this; },
        async first() { return connection.prepare(query).get(...this.args) ?? null; },
        async run() { return connection.prepare(query).run(...this.args); },
        read() { return { results: connection.prepare(query).all(...this.args) }; },
      };
      return statement;
    },
    async batch(statements) {
      connection.exec('BEGIN');
      try { const results = statements.map(statement => statement.read()); connection.exec('COMMIT'); return results; }
      catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
  };
}
try {
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  const load = async name => import(pathToFileURL(await compile(name)).href);
  const { shopProducts, validatePurchase, ShopError } = await load('lib/shop');
  const { getShopState, purchaseProduct } = await load('lib/shop-server');
  const { tr, strings } = await load('lib/i18n');
  assert.equal(shopProducts.length, 60);
  assert.equal(new Set(shopProducts.map(p => p.id)).size, 60);
  for (const category of ['sweets', 'stationery']) assert.equal(shopProducts.filter(p => p.category === category).length, 30);
  for (const product of shopProducts) {
    assert.ok(Number.isInteger(product.price) && product.price >= 15 && product.price <= 90);
    assert.match(product.id, /^(sweets|stationery)-[a-z0-9-]+$/);
    assert.ok((await stat(join(root, 'public', product.image))).size > 0);
    for (const lang of ['en', 'ru', 'kk']) assert.ok(product.description[lang].trim());
  }
  for (const [key, labels] of Object.entries(strings).filter(([key]) => key.startsWith('shop'))) {
    for (const lang of ['en', 'ru', 'kk']) assert.ok(labels[lang].trim(), `${key}: ${lang}`);
  }
  const cheap = shopProducts.find(p => p.price === 15);
  const order = quantity => ({ requestId: randomUUID(), productId: cheap.id, quantity });
  const request = order(5);
  for (const input of [null, [], {}, { ...request, quantity: 0 }, { ...request, quantity: -1 },
    { ...request, quantity: 11 }, { ...request, quantity: 1.5 }, { ...request, quantity: '2' },
    { ...request, productId: 'missing' }, { ...request, requestId: 'bad' },
    { ...request, price: 1 }, { ...request, userId: 'someone-else' }]) assert.throws(() => validatePurchase(input), ShopError);
  const filename = join(directory, 'shop.sqlite');
  sqlite = new DatabaseSync(filename);
  const journal = JSON.parse(await readFile(join(root, 'drizzle/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries) sqlite.exec(await readFile(join(root, 'drizzle', entry.tag + '.sql'), 'utf8'));
  sqlite.prepare('INSERT INTO profiles VALUES (?,?,NULL,?)').run('alice', '{"name":"Alice"}', 1);
  sqlite.prepare('INSERT INTO awards VALUES (?,?,?,?)').run('alice', 'topic-0', 100, 1);
  sqlite.prepare('INSERT INTO awards VALUES (?,?,?,?)').run('bob', 'topic-0', 90, 1);
  sqlite.prepare('INSERT INTO awards VALUES (?,?,?,?)').run('bulk', 'topic-0', 1000, 1);
  let db = adapter(sqlite);
  assert.deepEqual((await getShopState(db, 'alice')).inventory, []);
  const first = await purchaseProduct(db, 'alice', request);
  assert.equal(first.receipt.total, 75);
  assert.equal(first.shop.balance, 25);
  assert.equal(first.shop.inventory[0].quantity, 5);
  const replay = await purchaseProduct(db, 'alice', request);
  assert.equal(replay.shop.balance, 25);
  assert.equal(replay.shop.inventory[0].quantity, 5);
  await assert.rejects(purchaseProduct(db, 'alice', { ...request, quantity: 4 }), error => error.message === 'shopConflict');
  await assert.rejects(purchaseProduct(db, 'alice', order(2)), error => error.message === 'shopInsufficient');
  const concurrent = await Promise.allSettled([purchaseProduct(db, 'alice', order(1)), purchaseProduct(db, 'alice', order(1))]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await getShopState(db, 'alice')).balance, 10);
  assert.equal((await getShopState(db, 'alice')).inventory[0].quantity, 6);
  const bob = await purchaseProduct(db, 'bob', request); // same ID, separate user
  assert.equal(bob.shop.balance, 15);
  assert.equal(bob.shop.inventory[0].quantity, 5);
  await assert.rejects(purchaseProduct(db, 'no-rewards', order(1)), error => error.message === 'shopInsufficient');
  const bulk = order(10);
  const repeated = await Promise.all(Array.from({ length: 12 }, () => purchaseProduct(db, 'bulk', bulk)));
  assert.ok(repeated.every(result => result.receipt.id === bulk.requestId));
  assert.equal((await getShopState(db, 'bulk')).balance, 850);
  assert.equal((await getShopState(db, 'bulk')).inventory[0].quantity, 10);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM shop_purchases WHERE user_id=?').get('bulk').n, 1);
  assert.equal(sqlite.prepare('SELECT amount FROM awards WHERE user_id=?').get('alice').amount, 100);
  assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM profiles WHERE user_id=?').get('alice').data).name, 'Alice');
  const beforeRestart = await getShopState(db, 'alice');
  sqlite.close(); sqlite = new DatabaseSync(filename); db = adapter(sqlite);
  assert.deepEqual(await getShopState(db, 'alice'), beforeRestart);

  const { default: Collection } = await load('components/shop-collection');
  const { default: Shop } = await load('components/kyomei-shop');
  const noop = () => {};
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  for (const lang of ['en', 'ru', 'kk']) {
    const state = bob.shop;
    const owned = renderToStaticMarkup(createElement(Collection, { shop: state, lang, onShop: noop }));
    assert.ok(owned.includes(escape(tr('shopOwned', lang).replace('{count}', '5'))));
    const empty = renderToStaticMarkup(createElement(Collection, { shop: await getShopState(db, 'empty'), lang, onShop: noop }));
    assert.ok(empty.includes(escape(tr('shopCollectionEmpty', lang))));
    const html = renderToStaticMarkup(createElement(Shop, { shop: state, lang, onUpdate: noop, onEarn: noop, onCollection: noop }));
    assert.equal((html.match(/class="shop-product"/g) || []).length, 60);
    assert.ok(html.includes(escape(tr('shopVirtual', lang))));
    for (const product of shopProducts) assert.ok(html.includes(escape(product.name)));
  }
  console.log('PASS: 60 products/assets, EN/RU/KK, real SQL purchases, quantities, wallet totals, invalid input, insufficient funds, duplicate requests, concurrent overspending, user isolation, persistence after restart, collection and shop rendering.');
} finally { sqlite?.close(); await rm(directory, { recursive: true, force: true }); }
