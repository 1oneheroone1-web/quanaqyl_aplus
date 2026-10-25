export function authOrigins(environment: NodeJS.ProcessEnv = process.env): {
  baseURL: string;
  trustedOrigins: string[];
} {
  const onVercel = environment.VERCEL === '1';

  function origin(value: string): string {
    // URL() normalizes paths, backslashes and some control characters. Reject
    // those before parsing so every configured entry is one exact origin.
    const controlCharacter = [...value].some(character => character.charCodeAt(0) <= 0x20 || character.charCodeAt(0) === 0x7f);
    if (!/^https?:\/\/[^/?#\\]+\/?$/i.test(value) || /[*@]/.test(value) || controlCharacter) {
      throw new Error('Auth URLs must be exact application origins without paths or wildcards.');
    }
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.hostname.includes('*') || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:' && !onVercel))) {
      throw new Error('Auth URLs must use HTTPS (HTTP is allowed only on local loopback).');
    }
    return url.origin;
  }

  function vercelOrigin(hostname: string | undefined): string | undefined {
    const value = hostname?.trim();
    return onVercel && value ? origin(`https://${value}`) : undefined;
  }

  const configured = environment.BETTER_AUTH_URL?.trim();
  const deployment = vercelOrigin(environment.VERCEL_URL);
  const branch = vercelOrigin(environment.VERCEL_BRANCH_URL);
  // Vercel exposes the production domain in Preview too. Preview must not
  // automatically trust the origin of the production application.
  const production = environment.VERCEL_ENV === 'production'
    ? vercelOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL) : undefined;
  const baseURL = (configured ? origin(configured) : undefined) || production || deployment
    || (!onVercel && environment.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined);
  if (!baseURL) throw new Error('Set BETTER_AUTH_URL to the application origin.');

  // Trust only operator configuration and exact platform-provided addresses.
  // Never infer an allowed origin from Host, forwarded headers or the request.
  const trustedOrigins = [...new Set([baseURL, production, deployment, branch]
    .filter((value): value is string => Boolean(value)))];
  return { baseURL, trustedOrigins };
}
