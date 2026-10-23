import { getAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unavailable(): Response {
  return Response.json({ code: 'AUTH_UNAVAILABLE', message: 'Account service is temporarily unavailable. Please try again later.' }, {
    status: 503,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

async function handle(request: Request): Promise<Response> {
  try {
    const response = await getAuth().handler(request);
    if (response.status >= 500) return unavailable();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    // Do not expose database URLs, secrets, credentials or adapter diagnostics to the browser.
    console.error('Authentication service unavailable. Check auth environment and database migrations.');
    return unavailable();
  }
}

export const GET = handle;
export const POST = handle;
