import { identity, database, protect, payload, json, failure, ApiError } from '@/lib/server';
import { getShopState, purchaseProduct } from '@/lib/shop-server';
import { ShopError } from '@/lib/shop';

export async function GET() {
  try { const user = await identity(); return json({ shop: await getShopState(database(), user.userId) }); }
  catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    protect(req);
    const user = await identity();
    return json(await purchaseProduct(database(), user.userId, await payload(req)));
  } catch (error) {
    return failure(error instanceof ShopError ? new ApiError(error.message, error.status) : error);
  }
}
