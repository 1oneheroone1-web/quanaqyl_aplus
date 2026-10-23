import { drizzle } from 'drizzle-orm/node-postgres';
import { getPool } from '../lib/database';
import * as schema from './schema';

export function getDb() { return drizzle(getPool(), { schema }); }
