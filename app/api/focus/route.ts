import { identity, database, protect, payload, json, failure, ApiError } from '@/lib/server';
import { commandFocus, getFocusState } from '@/lib/focus-server';
import { FocusError } from '@/lib/focus';

export async function GET() {
  try { const user = await identity(); return json(await getFocusState(database(), user.userId)); }
  catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    protect(req);
    const user = await identity();
    return json(await commandFocus(database(), user.userId, await payload(req)));
  } catch (error) { return failure(error instanceof FocusError ? new ApiError(error.message, error.status) : error); }
}
