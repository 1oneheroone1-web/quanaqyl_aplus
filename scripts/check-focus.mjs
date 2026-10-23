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

// Run the real focus service and migrations against temporary SQLite storage.
// No production data, authentication, API requests or user balances are changed.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'quanaqyl-focus-'));
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
function adapter(connection) {
  return {
    prepare(query) {
      return { args: [], bind(...args) { this.args = args; return this; },
        async first() { return connection.prepare(query).get(...this.args) ?? null; },
        async all() { return { results: connection.prepare(query).all(...this.args) }; },
        async run() { return this.execute(); },
        execute() { if (query.trim().startsWith('SELECT')) return { results: connection.prepare(query).all(...this.args) }; const result = connection.prepare(query).run(...this.args); return { meta: { changes: Number(result.changes) } }; },
      };
    },
    async batch(statements) {
      connection.exec('BEGIN');
      try { const results = statements.map(s => s.execute()); connection.exec('COMMIT'); return results; }
      catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
  };
}
try {
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  const load = async name => import(pathToFileURL(await compile(name)).href);
  const { validateFocusCommand, FocusError, analyzeFocus, defaultFocusTimer, transitionFocus } = await load('lib/focus');
  const { commandFocus, getFocusState } = await load('lib/focus-server');
  const { strings } = await load('lib/i18n');
  const request = (action, revision, extra = {}) => ({ action, revision, requestId: randomUUID(), ...extra });
  const start = request('start', 0, { workMinutes: 1, breakMinutes: 1 });
  for (const invalid of [null, {}, [], { ...start, workMinutes: 0 }, { ...start, workMinutes: 121 },
    { ...start, workMinutes: 1.5 }, { ...start, workMinutes: '25' }, { ...start, breakMinutes: 0 },
    { ...start, breakMinutes: 61 }, { ...start, revision: -1 }, { ...start, requestId: 'x' },
    { ...start, action: 'fake' }, { ...start, userId: 'another-user' }, { ...start, focusMs: 99999 },
    { ...start, deadline: 0 }]) assert.throws(() => validateFocusCommand(invalid), FocusError);
  for (const [key, labels] of Object.entries(strings).filter(([key]) => key.startsWith('focus'))) {
    for (const lang of ['en', 'ru', 'kk']) assert.ok(labels[lang]?.trim(), `${key} / ${lang}`);
  }
  const filename = join(directory, 'focus.sqlite');
  sqlite = new DatabaseSync(filename);
  const journal = JSON.parse(await readFile(join(root, 'drizzle/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries) sqlite.exec(await readFile(join(root, 'drizzle', entry.tag + '.sql'), 'utf8'));
  let db = adapter(sqlite);
  const t0 = Date.UTC(2026, 9, 22, 10);
  let s = await commandFocus(db, 'alice', start, t0);
  assert.equal(s.timer.deadline, t0 + 60000);
  assert.equal(s.timer.phase, 'work');
  assert.equal((await commandFocus(db, 'alice', start, t0 + 5000)).timer.revision, 1, 'retry must not restart');
  s = await commandFocus(db, 'alice', request('pause', 1), t0 + 15000);
  assert.equal(s.timer.remainingMs, 45000);
  assert.equal(s.timer.deadline, null);
  const pauseState = await getFocusState(db, 'alice', t0 + 3_600_000);
  assert.equal(pauseState.timer.remainingMs, 45000, 'paused time must stay fixed');
  s = await commandFocus(db, 'alice', request('resume', 2), t0 + 3_600_000);
  const end = t0 + 3_645_000;
  assert.equal(s.timer.deadline, end);
  const complete = request('sync', 3);
  s = await commandFocus(db, 'alice', complete, end + 1000);
  assert.equal(s.timer.phase, 'break');
  assert.equal(s.sessions.length, 1);
  assert.equal(s.sessions[0].focusMs, 60000, 'the hour-long pause must not count');
  assert.equal(s.sessions[0].completed, true);
  assert.equal(s.sessions[0].endedAt, end, 'background delay must not inflate time');
  assert.equal((await commandFocus(db, 'alice', complete, end + 2000)).sessions.length, 1);
  s = await commandFocus(db, 'alice', request('pause', 4), end + 20000);
  assert.equal(s.timer.remainingMs, 40000);
  s = await commandFocus(db, 'alice', request('resume', 5), end + 80000);
  s = await commandFocus(db, 'alice', request('sync', 6), end + 120000);
  assert.equal(s.timer.phase, 'idle', 'break ends without starting another work session');
  assert.equal(s.sessions.length, 1);
  s = await commandFocus(db, 'alice', request('start', 7, { workMinutes: 25, breakMinutes: 5 }), end + 130000);
  s = await commandFocus(db, 'alice', request('reset', 8), end + 142345);
  assert.equal(s.sessions[0].focusMs, 12345);
  assert.equal(s.sessions[0].completed, false);
  assert.equal(s.timer.phase, 'idle');
  const before = s.sessions.length;
  s = await commandFocus(db, 'alice', request('sync', 9), end + 145000);
  assert.equal(s.sessions.length, before);
  await assert.rejects(commandFocus(db, 'alice', request('start', 0, { workMinutes: 25, breakMinutes: 5 }), end + 150000), { message: 'focusConflict' });
  const bob = await getFocusState(db, 'bob', end + 150000);
  assert.equal(bob.sessions.length, 0, 'histories must be isolated');
  assert.equal(bob.timer.revision, 0);
  const competing = await Promise.allSettled([
    commandFocus(db, 'bob', request('start', 0, { workMinutes: 1, breakMinutes: 1 }), end + 150000),
    commandFocus(db, 'bob', request('start', 0, { workMinutes: 2, breakMinutes: 1 }), end + 150000),
  ]);
  assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1, 'only one concurrent start may win');
  let b = await getFocusState(db, 'bob', end + 150000);
  b = await commandFocus(db, 'bob', request('sync', b.timer.revision), end + 150000 + 86_400_000);
  assert.equal(b.timer.phase, 'idle');
  assert.equal(b.sessions.length, 1, 'a closed browser must not manufacture repeated cycles');
  // A stale pause at a phase boundary settles work rather than pausing the break.
  const boundary = transitionFocus({ ...defaultFocusTimer(), phase: 'work', status: 'running', workMinutes: 1, breakMinutes: 1, startedAt: t0, sessionId: 'test', deadline: t0 + 60000, remainingMs: 60000 }, request('pause', 0), t0 + 60000, 'unused');
  assert.equal(boundary.timer.phase, 'break'); assert.equal(boundary.timer.status, 'running');
  const stats = analyzeFocus(s.sessions, new Date(end + 150000));
  assert.equal(stats.focusMs, 72345);
  assert.equal(stats.completionRate, 50);
  assert.equal(stats.completed, 1); assert.equal(stats.total, 2); assert.equal(stats.activeDays, 1);
  assert.equal(stats.days.reduce((sum, day) => sum + day.focusMs, 0), stats.focusMs);
  assert.equal(analyzeFocus([], new Date(t0)).completionRate, null);
  assert.equal(analyzeFocus(s.sessions, new Date(t0 + 20 * 86_400_000)).total, 0);
  sqlite.close(); sqlite = new DatabaseSync(filename); db = adapter(sqlite);
  assert.equal((await getFocusState(db, 'alice', end + 150000)).sessions.length, 2, 'records persist after reopening storage');
  const FocusProvider = (await load('components/focus-provider')).default;
  const FocusTimer = (await load('components/focus-timer')).default;
  const FocusStats = (await load('components/focus-stats')).default;
  for (const lang of ['en', 'ru', 'kk']) {
    const html = renderToStaticMarkup(createElement(FocusProvider, { lang }, createElement(FocusTimer, { lang }), createElement(FocusStats, { lang })));
    assert.ok(html.includes('focus-work') && html.includes('focus-rest'));
    assert.ok(html.includes(strings.focusStats[lang]));
    assert.ok(!html.includes('undefined'));
  }
  console.log('Focus checks passed: work/break transitions, pause accounting, retries, stale and concurrent actions, isolation, durable history, analytics, and EN/RU/KK rendering.');
} finally {
  sqlite?.close(); await rm(directory, { recursive: true, force: true });
}
