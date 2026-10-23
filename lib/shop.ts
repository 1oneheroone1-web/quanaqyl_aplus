import products from './shop-products.json';
import type { Localized } from './catalog';

export type ShopCategory = 'sweets' | 'stationery';
export type ShopProduct = { id: string; name: string; category: ShopCategory; price: number; image: string; description: Localized };
export const shopProducts = products as ShopProduct[];
export const maxPurchaseQuantity = 10;
export type PurchaseRequest = { requestId: string; productId: string; quantity: number };
export type PurchaseReceipt = { id: string; productId: string; quantity: number; unitPrice: number; total: number; createdAt: number };
export type ShopState = {
  balance: number; earned: number; spent: number;
  inventory: { productId: string; quantity: number }[];
  purchases: PurchaseReceipt[];
};
export class ShopError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validatePurchase(input: unknown): PurchaseRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ShopError('shopInvalid');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !['requestId', 'productId', 'quantity'].includes(key)) ||
    typeof value.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId) ||
    typeof value.productId !== 'string' || !shopProducts.some(p => p.id === value.productId) ||
    typeof value.quantity !== 'number' || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > maxPurchaseQuantity
  ) throw new ShopError('shopInvalid');
  return { requestId: value.requestId, productId: value.productId, quantity: value.quantity };
}
