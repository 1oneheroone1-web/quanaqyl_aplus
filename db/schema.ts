import { pgTable, text, integer, bigint, primaryKey, check, index, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const milliseconds = (name: string) => bigint(name, { mode: 'number' });
export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey(), data: text('data').notNull(),
  photoKey: text('photo_key'), updatedAt: milliseconds('updated_at').notNull(),
});
export const attempts = pgTable('attempts', {
  userId: text('user_id').notNull(), id: text('id').notNull(), data: text('data').notNull(),
  createdAt: milliseconds('created_at').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] })]);
export const awards = pgTable('awards', {
  userId: text('user_id').notNull(), key: text('key').notNull(), amount: integer('amount').notNull(),
  createdAt: milliseconds('created_at').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.key] })]);
export const pauses = pgTable('pauses', {
  userId: text('user_id').notNull(), id: text('id').notNull(),
  start: milliseconds('start').notNull(), end: milliseconds('end'),
}, table => [primaryKey({ columns: [table.userId, table.id] })]);
export const shopPurchases = pgTable('shop_purchases', {
  userId: text('user_id').notNull(), id: text('id').notNull(), productId: text('product_id').notNull(),
  quantity: integer('quantity').notNull(), unitPrice: integer('unit_price').notNull(),
  total: integer('total').notNull(), createdAt: milliseconds('created_at').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] }), index('shop_purchases_user_date').on(table.userId, table.createdAt),
  check('shop_quantity_range', sql`${table.quantity} BETWEEN 1 AND 10`),
  check('shop_positive_price', sql`${table.unitPrice} > 0`),
  check('shop_total_matches', sql`${table.total} = ${table.quantity} * ${table.unitPrice}`),
]);
export const focusTimers = pgTable('focus_timers', {
  userId: text('user_id').primaryKey(), data: text('data').notNull(),
  revision: integer('revision').notNull(), requestId: text('request_id').notNull(),
});
export const focusSessions = pgTable('focus_sessions', {
  userId: text('user_id').notNull(), id: text('id').notNull(),
  startedAt: milliseconds('started_at').notNull(), endedAt: milliseconds('ended_at').notNull(),
  plannedMs: milliseconds('planned_ms').notNull(), focusMs: milliseconds('focus_ms').notNull(), completed: integer('completed').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] }), index('focus_sessions_user_date').on(table.userId, table.endedAt),
  check('focus_valid_duration', sql`${table.focusMs} > 0 AND ${table.focusMs} <= ${table.plannedMs} AND ${table.plannedMs} BETWEEN 60000 AND 7200000`),
  check('focus_valid_dates', sql`${table.endedAt} >= ${table.startedAt} AND ${table.focusMs} <= ${table.endedAt} - ${table.startedAt}`),
  check('focus_valid_completion', sql`${table.completed} IN (0,1) AND (${table.completed} = 0 OR ${table.focusMs} = ${table.plannedMs})`),
]);
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType() { return 'bytea'; } });
export const photos = pgTable('photos', {
  userId: text('user_id').primaryKey(), contentType: text('content_type').notNull(),
  bytes: bytea('bytes').notNull(), updatedAt: milliseconds('updated_at').notNull(),
}, table => [
  check('photo_size', sql`octet_length(${table.bytes}) BETWEEN 1 AND 2097152`),
  check('photo_content_type', sql`${table.contentType} IN ('image/png','image/jpeg','image/webp')`),
]);
