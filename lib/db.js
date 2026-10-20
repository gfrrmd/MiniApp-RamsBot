const { Pool, types } = require('pg');

// BIGINT (int8) dan NUMERIC dikembalikan sebagai string oleh pg. ID Telegram & Rupiah aman sebagai Number.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

let pool;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL belum diatur');
    pool = new Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });
    pool.on('error', (e) => console.error('[pg] pool error', e.message));
  }
  return pool;
}

const db = {
  async q(text, params = []) { return (await getPool().query(text, params)).rows; },
  async one(text, params = []) { return (await db.q(text, params))[0] || null; },
  async run(text, params = []) { return (await getPool().query(text, params)).rowCount; },
};

// Transaksi: fn menerima objek dengan q/one/run yang sama bentuknya dengan `db`.
async function tx(fn) {
  const c = await getPool().connect();
  const t = {
    inTx: true,
    async q(text, params = []) { return (await c.query(text, params)).rows; },
    async one(text, params = []) { return (await t.q(text, params))[0] || null; },
    async run(text, params = []) { return (await c.query(text, params)).rowCount; },
  };
  try {
    await c.query('BEGIN');
    const r = await fn(t);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch (_) { /* abaikan */ }
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { db, tx };
