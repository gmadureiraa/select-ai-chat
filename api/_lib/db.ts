// Shared Neon DB pool for Vercel Functions
// Replaces createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { Pool, neonConfig } from '@neondatabase/serverless';

// Reuse pool across warm invocations
let _pool: Pool | null = null;

/**
 * Config recomendada Neon serverless + Vercel Fluid Compute:
 *
 * - `max`: cap absoluto de conexões simultâneas. Cada Vercel container tem
 *   ~1-3 invocations concurrent (Fluid Compute pode chegar a 10 com
 *   maxConcurrency). max=20 cobre worst case sem entupir o pool Neon.
 *   Neon Free plan suporta 100 conn totais; com 5+ containers warm em pico
 *   isso preserva headroom.
 *
 * - `idleTimeoutMillis: 30s`: conexões soltas fecham rápido pra liberar
 *   slots quando o tráfego cai. Antes era default 10s — agressivo demais
 *   pra crons batch.
 *
 * - `connectionTimeoutMillis: 10s`: se o pool tá cheio e nenhuma conn livre
 *   em 10s, falha rápido (vs aguardar indefinidamente e estourar function
 *   maxDuration de 60s).
 *
 * - `keepAlive: true`: TCP keep-alive evita NAT timeout em conns longas
 *   (relevante pros crons que rodam batch).
 */
export function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not configured');
  }
  _pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });
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
