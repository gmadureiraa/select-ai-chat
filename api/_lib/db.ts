// Shared Neon DB pool for Vercel Functions
// Replaces createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { Pool, neonConfig } from '@neondatabase/serverless';

// Reuse pool across warm invocations
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not configured');
  }
  _pool = new Pool({ connectionString });
  return _pool;
}

/**
 * Execute a parametrized query and return rows.
 *
 * Usage:
 *   const rows = await query<{ id: string }>('SELECT id FROM clients WHERE user_id = $1', [userId]);
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a query and return a single row (or null).
 */
export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Helper to insert a row and return it.
 */
export async function insertRow<T = any>(
  table: string,
  data: Record<string, any>
): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const rows = await query<T>(sql, values);
  return rows[0];
}
