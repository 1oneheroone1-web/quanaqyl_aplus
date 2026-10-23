import { sqliteTable, text, integer, primaryKey, check, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const profiles=sqliteTable('profiles',{userId:text('user_id').primaryKey(),data:text('data').notNull(),photoKey:text('photo_key'),updatedAt:integer('updated_at').notNull()});
export const attempts=sqliteTable('attempts',{userId:text('user_id').notNull(),id:text('id').notNull(),data:text('data').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const awards=sqliteTable('awards',{userId:text('user_id').notNull(),key:text('key').notNull(),amount:integer('amount').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.key]})]);
export const pauses=sqliteTable('pauses',{userId:text('user_id').notNull(),id:text('id').notNull(),start:integer('start').notNull(),end:integer('end')},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const shopPurchases = sqliteTable('shop_purchases', {
  userId: text('user_id').notNull(), id: text('id').notNull(), productId: text('product_id').notNull(),
  quantity: integer('quantity').notNull(), unitPrice: integer('unit_price').notNull(),
  total: integer('total').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({columns: [t.userId, t.id]}), index('shop_purchases_user_date').on(t.userId, t.createdAt),
  check('shop_quantity_range', sql`${t.quantity} BETWEEN 1 AND 10`),
  check('shop_positive_price', sql`${t.unitPrice} > 0`),
  check('shop_total_matches', sql`${t.total} = ${t.quantity} * ${t.unitPrice}`),
]);
export const focusTimers = sqliteTable('focus_timers', {
  userId: text('user_id').primaryKey(), data: text('data').notNull(),
  revision: integer('revision').notNull(), requestId: text('request_id').notNull(),
});
export const focusSessions = sqliteTable('focus_sessions', {
  userId: text('user_id').notNull(), id: text('id').notNull(),
  startedAt: integer('started_at').notNull(), endedAt: integer('ended_at').notNull(),
  plannedMs: integer('planned_ms').notNull(), focusMs: integer('focus_ms').notNull(), completed: integer('completed').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.id] }), index('focus_sessions_user_date').on(t.userId, t.endedAt),
  check('focus_valid_duration', sql`${t.focusMs} > 0 AND ${t.focusMs} <= ${t.plannedMs} AND ${t.plannedMs} BETWEEN 60000 AND 7200000`),
  check('focus_valid_dates', sql`${t.endedAt} >= ${t.startedAt} AND ${t.focusMs} <= ${t.endedAt} - ${t.startedAt}`),
  check('focus_valid_completion', sql`${t.completed} IN (0,1) AND (${t.completed} = 0 OR ${t.focusMs} = ${t.plannedMs})`),
]);
