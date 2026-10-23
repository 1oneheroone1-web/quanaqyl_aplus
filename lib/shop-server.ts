import { shopProducts, validatePurchase, ShopError, type PurchaseReceipt, type ShopState } from './shop';

const receiptColumns = 'id, product_id AS productId, quantity, unit_price AS unitPrice, total, created_at AS createdAt';

export async function getShopState(db: D1Database, userId: string): Promise<ShopState> {
  // A D1 batch gives the wallet and collection one consistent snapshot.
  const [wallet, inventory, history] = await db.batch([
    db.prepare(`SELECT COALESCE((SELECT SUM(amount) FROM awards WHERE user_id=?),0) AS earned,
      COALESCE((SELECT SUM(total) FROM shop_purchases WHERE user_id=?),0) AS spent`).bind(userId, userId),
    db.prepare('SELECT product_id AS productId, SUM(quantity) AS quantity FROM shop_purchases WHERE user_id=? GROUP BY product_id ORDER BY MAX(created_at) DESC, product_id').bind(userId),
    db.prepare(`SELECT ${receiptColumns} FROM shop_purchases WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 20`).bind(userId),
  ]);
  const { earned, spent } = wallet.results[0] as { earned: number; spent: number };
  return { earned, spent, balance: earned - spent,
    inventory: inventory.results as ShopState['inventory'], purchases: history.results as PurchaseReceipt[] };
}

export async function purchaseProduct(db: D1Database, userId: string, input: unknown) {
  const request = validatePurchase(input);
  const product = shopProducts.find(p => p.id === request.productId)!;
  const readReceipt = () => db.prepare(`SELECT ${receiptColumns} FROM shop_purchases WHERE user_id=? AND id=?`)
    .bind(userId, request.requestId).first<PurchaseReceipt>();
  let receipt = await readReceipt();
  if (!receipt) {
    const total = product.price * request.quantity;
    // Checking funds and spending them is ONE atomic statement. Concurrent tabs
    // cannot spend the same balance. The client never supplies a trusted price.
    await db.prepare(`INSERT INTO shop_purchases (user_id,id,product_id,quantity,unit_price,total,created_at)
      SELECT ?,?,?,?,?,?,? WHERE
        COALESCE((SELECT SUM(amount) FROM awards WHERE user_id=?),0) -
        COALESCE((SELECT SUM(total) FROM shop_purchases WHERE user_id=?),0) >= ?
      ON CONFLICT(user_id,id) DO NOTHING`)
      .bind(userId, request.requestId, product.id, request.quantity, product.price, total, Date.now(), userId, userId, total).run();
    receipt = await readReceipt();
  }
  if (!receipt) throw new ShopError('shopInsufficient', 409);
  // Network retries return the original purchase; a reused ID cannot change it.
  if (receipt.productId !== request.productId || receipt.quantity !== request.quantity) throw new ShopError('shopConflict', 409);
  return { receipt, shop: await getShopState(db, userId) };
}
