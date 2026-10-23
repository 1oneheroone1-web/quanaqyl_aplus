/**
 * Integration checks against a running server backed by a disposable test database.
 * BASE_URL=http://localhost:3000 node scripts/check-auth-http.mjs
 * Non-loopback test deployments also require AUTH_TEST_ALLOW_NONLOCAL=1.
 * Creates two users under example.test; remove the disposable DB after validation.
 * Passwords, session cookies and database credentials are never written to output.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.BASE_URL || 'http://localhost:3000');
assert(['http:', 'https:'].includes(base.protocol), 'BASE_URL must use HTTP(S).');
assert(!base.username && !base.password && base.pathname === '/' && !base.search && !base.hash, 'BASE_URL must be an origin.');
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(loopback || process.env.AUTH_TEST_ALLOW_NONLOCAL === '1', 'Use a disposable loopback server, or explicitly enable a nonlocal test deployment.');
const origin = base.origin;
const runId = randomUUID();
const password = `Auth-test-${randomUUID()}-${randomUUID()}`;
const emailA = `auth-a-${runId}@example.test`;
const emailB = `auth-b-${runId}@example.test`;
const cases = [];
let activeCase;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

class Client {
  cookies = new Map();

  async request(path, options = {}) {
    const { headers: extraHeaders, json, ...rest } = options;
    const headers = new Headers(extraHeaders);
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    // Documentation-only IP range; the local server is not exposed to untrusted clients.
    if (loopback) headers.set('x-forwarded-for', '192.0.2.123');
    if (rest.method && rest.method !== 'GET') headers.set('origin', headers.get('origin') || origin);
    if (json !== undefined) headers.set('content-type', 'application/json');
    const response = await fetch(new URL(path, origin), {
      ...rest,
      headers,
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    for (const entry of response.headers.getSetCookie()) {
      const first = entry.split(';', 1)[0];
      const equals = first.indexOf('=');
      if (equals < 0) continue;
      const name = first.slice(0, equals), value = first.slice(equals + 1);
      if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(entry)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }

  clone() {
    const result = new Client();
    result.cookies = new Map(this.cookies);
    return result;
  }
}

async function check(name, run) {
  activeCase = name;
  const start = Date.now();
  await run();
  cases.push({ name, status: 'passed', elapsedMs: Date.now() - start });
}

async function expectJSON(response, status) {
  assert.equal(response.status, status, `Unexpected HTTP status for ${new URL(response.url).pathname}`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  return response.json();
}

function authProps(html) {
  // Next.js embeds the server-to-client props inside its RSC scripts.
  return html.replaceAll('\\"', '"').match(/"returnTo"\s*:\s*"([^"\n]*)"/)?.[1];
}

const anonymous = new Client(), userA = new Client(), userB = new Client();
let accountA;

try {
  await check('anonymous private APIs reject access', async () => {
    await expectJSON(await anonymous.request('/api/account'), 401);
    await expectJSON(await anonymous.request('/api/photo'), 401);
    const session = await expectJSON(await anonymous.request('/api/auth/get-session'), 200);
    assert.equal(session, null);
  });

  await check('forged Sites identity headers cannot authenticate', async () => {
    await expectJSON(await anonymous.request('/api/account', { headers: {
      'oai-authenticated-user-id': 'forged-owner',
      'oai-authenticated-user-email': 'forged@example.test',
      'oai-authenticated-user-full-name': 'Forged owner',
    } }), 401);
  });

  await check('signup validates password, email and display name', async () => {
    const short = await anonymous.request('/api/auth/sign-up/email', { method: 'POST', json: { name: 'Test', email: `short-${runId}@example.test`, password: 'short' } });
    assert.equal(short.status, 400);
    const invalidEmail = await anonymous.request('/api/auth/sign-up/email', { method: 'POST', json: { name: 'Test', email: 'invalid', password } });
    assert.equal(invalidEmail.status, 400);
    const blankName = await anonymous.request('/api/auth/sign-up/email', { method: 'POST', json: { name: '  ', email: `blank-${runId}@example.test`, password } });
    assert.equal(blankName.status, 400);
  });

  await check('signup creates a persisted authenticated account', async () => {
    const response = await userA.request('/api/auth/sign-up/email', { method: 'POST', json: { name: 'Auth test A', email: emailA, password } });
    const cookieHeaders = response.headers.getSetCookie();
    assert(cookieHeaders.some(value => /quanaqyl\.session_token=/.test(value) && /httponly/i.test(value) && /samesite=lax/i.test(value)), 'Session cookie must be HttpOnly and SameSite=Lax.');
    if (base.protocol === 'https:') assert(cookieHeaders.some(value => /quanaqyl\.session_token=/.test(value) && /;\s*secure(?:;|$)/i.test(value)), 'HTTPS session cookies must be Secure.');
    await expectJSON(response, 200);
    const session = await expectJSON(await userA.request('/api/auth/get-session'), 200);
    assert.equal(session.user.email, emailA);
    assert.equal(session.user.emailVerified, false);
    accountA = await expectJSON(await userA.request('/api/account'), 200);
    assert.equal(accountA.email, emailA);
  });

  await check('cross-origin auth and app mutations are rejected', async () => {
    const forged = { origin: 'https://untrusted.example.test' };
    const signIn = await anonymous.request('/api/auth/sign-in/email', { method: 'POST', headers: forged, json: { email: emailA, password } });
    assert.equal(signIn.status, 403);
    const profile = await userA.request('/api/profile', { method: 'PUT', headers: forged, json: { ...accountA.profile, city: 'Must not save' } });
    assert.equal(profile.status, 403);
    const signOut = await userA.request('/api/auth/sign-out', { method: 'POST', headers: forged, json: {} });
    assert.equal(signOut.status, 403);
    await expectJSON(await userA.request('/api/account'), 200);
  });

  await check('profile and photo stay isolated between users', async () => {
    const city = `Test ${runId}`;
    await expectJSON(await userA.request('/api/profile', { method: 'PUT', json: { ...accountA.profile, city } }), 200);
    const upload = new FormData();
    upload.set('photo', new File([png], 'test.png', { type: 'image/png' }));
    await expectJSON(await userA.request('/api/photo', { method: 'POST', body: upload }), 200);
    const ownPhoto = await userA.request('/api/photo');
    assert.equal(ownPhoto.status, 200);
    assert.match(ownPhoto.headers.get('cache-control') || '', /private.*no-store/);
    assert.deepEqual(Buffer.from(await ownPhoto.arrayBuffer()), png);

    await expectJSON(await userB.request('/api/auth/sign-up/email', { method: 'POST', json: { name: 'Auth test B', email: emailB, password } }), 200);
    const secondAccount = await expectJSON(await userB.request('/api/account'), 200);
    assert.equal(secondAccount.email, emailB);
    assert.notEqual(secondAccount.profile.city, city);
    assert.equal((await userB.request('/api/photo')).status, 404);
    const spoofed = await expectJSON(await userB.request('/api/account', { headers: {
      'oai-authenticated-user-id': 'forged-owner', 'oai-authenticated-user-email': emailA,
    } }), 200);
    assert.equal(spoofed.email, emailB);
  });

  await check('login and logout return paths reject external navigation', async () => {
    for (const page of ['login', 'logout']) {
      for (const returnTo of ['https://untrusted.example.test/path', '//untrusted.example.test', '/\\untrusted.example.test', '/login', '/logout']) {
        const response = await anonymous.request(`/${page}?return_to=${encodeURIComponent(returnTo)}`);
        assert.equal(response.status, 200);
        assert.equal(authProps(await response.text()), '/', `${page} must normalize an unsafe return path.`);
      }
      const response = await anonymous.request(`/${page}?return_to=${encodeURIComponent('/?view=learn')}`);
      assert.equal(authProps(await response.text()), '/?view=learn');
    }
  });

  await check('GET logout does not change the session', async () => {
    const response = await userA.request('/logout');
    assert.equal(response.status, 200);
    assert(!response.headers.getSetCookie().some(value => /quanaqyl\.session_token=/.test(value)));
    await expectJSON(await userA.request('/api/account'), 200);
    assert([404, 405].includes((await userA.request('/api/auth/sign-out')).status), 'GET must not invoke signout.');
    await expectJSON(await userA.request('/api/account'), 200);
  });

  await check('signout revokes the saved session token', async () => {
    const stolenOldSession = userA.clone();
    await expectJSON(await userA.request('/api/auth/sign-out', { method: 'POST', json: {} }), 200);
    await expectJSON(await userA.request('/api/account'), 401);
    await expectJSON(await stolenOldSession.request('/api/account'), 401);
    assert.equal(await expectJSON(await stolenOldSession.request('/api/auth/get-session'), 200), null);
  });

  await check('wrong password is rejected and correct login restores account', async () => {
    const bad = await userA.request('/api/auth/sign-in/email', { method: 'POST', json: { email: emailA, password: `wrong-${randomUUID()}` } });
    assert.equal(bad.status, 401);
    await expectJSON(await userA.request('/api/account'), 401);
    await expectJSON(await userA.request('/api/auth/sign-in/email', { method: 'POST', json: { email: emailA, password } }), 200);
    const account = await expectJSON(await userA.request('/api/account'), 200);
    assert.equal(account.email, emailA);
    await expectJSON(await userA.request('/api/auth/sign-out', { method: 'POST', json: {} }), 200);
    await expectJSON(await userB.request('/api/auth/sign-out', { method: 'POST', json: {} }), 200);
  });

  process.stdout.write(`${JSON.stringify({ suite: 'auth-http', status: 'passed', cases }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ suite: 'auth-http', status: 'failed', failedCase: activeCase, cases, error: error instanceof Error ? error.message : 'Unknown test error' }, null, 2)}\n`);
  process.exitCode = 1;
}
