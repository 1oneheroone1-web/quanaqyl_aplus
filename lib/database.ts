import { Pool, types, type PoolClient, type QueryResult } from 'pg';

// Millisecond timestamps and SUM(integer) are int8 in PostgreSQL. Refuse values
// that JavaScript cannot represent exactly instead of silently losing precision.
types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds the safe JavaScript range');
  return number;
});

let pool: Pool | undefined;
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
    pool.on('error', error => console.error('Idle database connection failed', error.message));
  }
  return pool;
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>, connectionPool = getPool()): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await connectionPool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (attempt >= 3 || (code !== '40001' && code !== '40P01')) throw error;
    } finally {
      client.release();
    }
    await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt + Math.floor(Math.random() * 20)));
  }
}

/** Translate bound SQLite placeholders without touching SQL literals/comments.
 * Existing mixed-case AS aliases also need quotes to retain the JSON API shape.
 */
export function postgresSql(source: string): { text: string; parameters: number } {
  let output = '', index = 0, parameters = 0, alias = false;
  while (index < source.length) {
    const char = source[index], next = source[index + 1];
    if (char === '-' && next === '-') {
      const end = source.indexOf('\n', index + 2);
      const stop = end < 0 ? source.length : end + 1;
      output += source.slice(index, stop); index = stop; continue;
    }
    if (char === '/' && next === '*') {
      const start = index; index += 2; let depth = 1;
      while (index < source.length && depth) {
        if (source[index] === '/' && source[index + 1] === '*') { depth++; index += 2; }
        else if (source[index] === '*' && source[index + 1] === '/') { depth--; index += 2; }
        else index++;
      }
      if (depth) throw new Error('Unterminated SQL comment');
      output += source.slice(start, index); continue;
    }
    const dollar = char === '$' ? source.slice(index).match(/^(?:\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/)?.[0] : undefined;
    if (dollar) {
      const end = source.indexOf(dollar, index + dollar.length);
      if (end < 0) throw new Error('Unterminated SQL dollar quote');
      output += source.slice(index, end + dollar.length); index = end + dollar.length; alias = false; continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      const quote = char, start = index++;
      const escapeString = quote === "'" && /(?:^|[^A-Za-z0-9_])[Ee]$/.test(source.slice(0, start));
      let closed = false;
      while (index < source.length) {
        if (escapeString && source[index] === '\\') { index += 2; continue; }
        if (source[index] === quote) {
          if (source[index + 1] === quote) { index += 2; continue; }
          index++; closed = true; break;
        }
        index++;
      }
      if (!closed) throw new Error('Unterminated SQL quote');
      const value = source.slice(start, index);
      output += quote === '`' ? '"' + value.slice(1, -1).replace(/``/g, '`').replace(/"/g, '""') + '"' : value;
      alias = false; continue;
    }
    if (char === '?') { output += '$' + ++parameters; index++; alias = false; continue; }
    if (/[A-Za-z_]/.test(char)) {
      const token = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/)![0];
      output += alias && /[A-Z]/.test(token) && /[a-z]/.test(token) ? '"' + token + '"' : token;
      alias = token.toLowerCase() === 'as'; index += token.length; continue;
    }
    output += char; index++;
    if (!/\s/.test(char)) alias = false;
  }
  return { text: output, parameters };
}

export type DatabaseResult<T = unknown> = { results: T[]; meta: { changes: number } };
function result<T>(query: QueryResult): DatabaseResult<T> {
  return { results: query.rows as T[], meta: { changes: query.rowCount ?? 0 } };
}

export class PreparedStatement {
  private readonly query: ReturnType<typeof postgresSql>;
  private values: unknown[] = [];
  constructor(sql: string, private readonly connectionPool: Pool) { this.query = postgresSql(sql); }
  bind(...values: unknown[]): PreparedStatement {
    const statement = new PreparedStatement(this.query.text, this.connectionPool);
    // Preserve the already-translated SQL and its original parameter count.
    statement.query.text = this.query.text;
    statement.query.parameters = this.query.parameters;
    statement.values = values;
    return statement;
  }
  private validate() {
    if (this.values.length !== this.query.parameters) throw new Error('SQL parameter count does not match bound values');
  }
  async execute(client: Pool | PoolClient) {
    this.validate();
    return client.query(this.query.text, this.values);
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const response = await this.execute(this.connectionPool);
    return (response.rows[0] as T | undefined) ?? null;
  }
  async all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    return result<T>(await this.execute(this.connectionPool));
  }
  async run<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    return withTransaction(async client => result<T>(await this.execute(client)), this.connectionPool);
  }
}

export interface Database {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<DatabaseResult[]>;
}
export function createDatabase(connectionPool: Pool): Database {
  return {
    prepare(sql) { return new PreparedStatement(sql, connectionPool); },
    batch(statements) { return withTransaction(async client => {
      const results: DatabaseResult[] = [];
      for (const statement of statements) results.push(result(await statement.execute(client)));
      return results;
    }, connectionPool); },
  };
}
export function database(): Database { return createDatabase(getPool()); }
