import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/auth-origins.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { authOrigins } = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));

const vercel = {
  NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production',
  VERCEL_PROJECT_PRODUCTION_URL: 'quanaqylaplus.vercel.app',
  VERCEL_URL: 'quanaqylaplus-current-1oneheroone1-web.vercel.app',
  VERCEL_BRANCH_URL: 'quanaqylaplus-git-main-1oneheroone1-web.vercel.app',
};

test('production accepts its permanent domain alongside the current deployment and branch', () => {
  assert.deepEqual(authOrigins(vercel), {
    baseURL: 'https://quanaqylaplus.vercel.app',
    trustedOrigins: [
      'https://quanaqylaplus.vercel.app',
      'https://quanaqylaplus-current-1oneheroone1-web.vercel.app',
      'https://quanaqylaplus-git-main-1oneheroone1-web.vercel.app',
    ],
  });
});

test('an explicit custom domain remains canonical while the Vercel addresses work', () => {
  assert.deepEqual(authOrigins({ ...vercel, BETTER_AUTH_URL: ' https://learn.example.com/ ' }), {
    baseURL: 'https://learn.example.com',
    trustedOrigins: [
      'https://learn.example.com',
      'https://quanaqylaplus.vercel.app',
      'https://quanaqylaplus-current-1oneheroone1-web.vercel.app',
      'https://quanaqylaplus-git-main-1oneheroone1-web.vercel.app',
    ],
  });
});

test('preview uses its own deployment and branch without automatically trusting production', () => {
  assert.deepEqual(authOrigins({ ...vercel, VERCEL_ENV: 'preview' }), {
    baseURL: 'https://quanaqylaplus-current-1oneheroone1-web.vercel.app',
    trustedOrigins: [
      'https://quanaqylaplus-current-1oneheroone1-web.vercel.app',
      'https://quanaqylaplus-git-main-1oneheroone1-web.vercel.app',
    ],
  });
});

test('older Vercel deployments without a production-domain variable use the deployment', () => {
  assert.equal(authOrigins({ ...vercel, VERCEL_PROJECT_PRODUCTION_URL: undefined }).baseURL,
    'https://quanaqylaplus-current-1oneheroone1-web.vercel.app');
});

test('duplicate addresses are normalized and deduplicated', () => {
  assert.deepEqual(authOrigins({ ...vercel, BETTER_AUTH_URL: 'https://QUANAQYLAPLUS.vercel.app:443/' }).trustedOrigins,
    ['https://quanaqylaplus.vercel.app', 'https://quanaqylaplus-current-1oneheroone1-web.vercel.app',
      'https://quanaqylaplus-git-main-1oneheroone1-web.vercel.app']);
});

test('local development works without trusting Vercel variables outside Vercel', () => {
  assert.deepEqual(authOrigins({ ...vercel, VERCEL: undefined, NODE_ENV: 'development' }), {
    baseURL: 'http://localhost:3000', trustedOrigins: ['http://localhost:3000'],
  });
});

test('native production tests may explicitly use a local loopback origin', () => {
  assert.deepEqual(authOrigins({ NODE_ENV: 'production', BETTER_AUTH_URL: 'http://127.0.0.1:55433' }), {
    baseURL: 'http://127.0.0.1:55433', trustedOrigins: ['http://127.0.0.1:55433'],
  });
});

test('missing production configuration fails closed', () => {
  assert.throws(() => authOrigins({ NODE_ENV: 'production' }));
  assert.throws(() => authOrigins({ VERCEL: '1' }));
});

test('Vercel rejects local HTTP even if explicitly configured', () => {
  assert.throws(() => authOrigins({ ...vercel, BETTER_AUTH_URL: 'http://localhost:3000' }));
});

test('malformed explicit origins fail instead of falling back to an otherwise valid deployment', () => {
  for (const BETTER_AUTH_URL of [
    'https://*.vercel.app', 'https://%2a.vercel.app', 'https://example.com/login', 'https://example.com/a/..',
    'https://example.com?x=1', 'https://example.com#fragment', 'https://user:password@example.com',
    'https://@example.com', 'https://example.com\\', 'https://exam\nple.com', 'https://example.com\u0000',
    'http://example.com', 'javascript:alert(1)',
  ]) assert.throws(() => authOrigins({ ...vercel, BETTER_AUTH_URL }), undefined, BETTER_AUTH_URL);
});

test('platform variables must also contain exact hostnames', () => {
  for (const VERCEL_URL of ['*.vercel.app', 'good.vercel.app/path', 'user@good.vercel.app',
    'https://good.vercel.app', 'good.vercel.app\\', 'good.vercel.app?x=1']) {
    assert.throws(() => authOrigins({ ...vercel, VERCEL_URL }), undefined, VERCEL_URL);
  }
});
