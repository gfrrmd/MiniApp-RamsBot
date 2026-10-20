// Logika bisnis bersama (user & admin). Port dari bot Python agar perilaku identik dan memakai database yang sama.
const { db, tx } = require('./db');
const U = require('./util');
const tg = require('./tg');
const { convertQris, validateQris, summarizeQris } = require('./qris');

const { HttpError, isoNow, toDb, parseDb, addDays, rp, esc } = U;
const MAX_TOKEN_USES = 3;
const COUNTED = "('pending','verifying','paid','revoked')";   // pesanan yang memakan kuota promo
const err = (status, msg, extra) => new HttpError(status, msg, extra);

// ── Pengaturan bot (key-value, dipakai bersama bot) ──────────────────────────
async function getSetting(key, def = null, d = db) {
  const r = await d.one('SELECT value FROM bot_settings WHERE key=$1', [key]);
  return r && r.value != null ? r.value : def;
}
const setSetting = (key, value, d = db) =>
  d.run('INSERT INTO bot_settings (key, value) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, String(value)]);
const expireMinutes = async (d = db) => Math.max(5, parseInt(await getSetting('pay_expire_min', '60', d), 10) || 60);

// ── Pengguna ─────────────────────────────────────────────────────────────────
async function upsertUser(u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || String(u.id);
  await db.run(
    `INSERT INTO users (user_id, username, full_name, created_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT(user_id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name`,
    [u.id, u.username || null, name, isoNow()]);
}

// ── Langganan ────────────────────────────────────────────────────────────────
const getSubRow = (uid, d = db) =>
  d.one('SELECT paid_at, expired_at, is_active, plan FROM subscriptions WHERE user_id=$1', [uid]);

function subState(row) {
  if (!row) return { state: 'none', plan: null, expired: null, remainingMs: 0 };
  const exp = parseDb(row.expired_at);
  const now = Date.now();
  let state = 'active';
  if (!row.is_active) state = 'revoked';
  else if (!exp || exp.getTime() <= now) state = 'expired';
  return { state, plan: row.plan, expired: exp, remainingMs: exp ? Math.max(0, exp.getTime() - now) : 0 };
}
const isLiveVip = (st) => st.state === 'active' && st.plan === 'vip';

async function extendSub(d, uid, days) {
  const now = new Date();
  const row = await getSubRow(uid, d);
  let base = now, paidAt = isoNow();
  if (row && row.is_active && row.plan === 'vip') {
    const cur = parseDb(row.expired_at);
    if (cur && cur > now) { base = cur; paidAt = row.paid_at || paidAt; }
  }
  const exp = addDays(base, days);
  await d.run(
    `INSERT INTO subscriptions (user_id, plan, paid_at, expired_at, is_active, reminder_stage) VALUES ($1,'vip',$2,$3,1,0)
     ON CONFLICT(user_id) DO UPDATE SET paid_at=EXCLUDED.paid_at, expired_at=EXCLUDED.expired_at, is_active=1, plan='vip', reminder_stage=0`,
    [uid, paidAt, toDb(exp)]);
  return exp;
}

async function requireActive(uid) {
  const st = subState(await getSubRow(uid));
  if (st.state !== 'active') throw err(403, 'Fitur ini khusus pengguna dengan VIP atau trial aktif.');
  return st;
}

// ── Token VIP ────────────────────────────────────────────────────────────────
const TOKEN_COLS = 'token, holder_id, uses, max_uses';
const getToken = (uid, d = db) => d.one(`SELECT ${TOKEN_COLS} FROM vip_tokens WHERE holder_id=$1`, [uid]);

async function issueToken(d, uid) {
  for (let i = 0; i < 5; i++) {
    try {
      return await d.one(
        `INSERT INTO vip_tokens (token, holder_id, uses, max_uses, created_at, updated_at) VALUES ($1,$2,0,$3,$4,$4)
         ON CONFLICT (holder_id) DO UPDATE SET token=EXCLUDED.token, uses=0, max_uses=EXCLUDED.max_uses,
           created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at
         RETURNING ${TOKEN_COLS}`,
        [U.generateToken(), uid, MAX_TOKEN_USES, isoNow()]);
    } catch (e) {
      if (e.code === '23505' && !d.inTx) continue;       // kode kebetulan kembar
      throw e;
    }
  }
  throw err(500, 'Gagal membuat token');
}

// Token user; dibuat bila belum ada DAN user punya VIP berbayar aktif (VIP lama / hasil gift).
async function ensureToken(uid) {
  const tok = await getToken(uid);
  if (tok) return tok;
  return isLiveVip(subState(await getSubRow(uid))) ? issueToken(db, uid) : null;
}

async function transferByToken(code, toId) {
  return tx(async (t) => {
    const tk = await t.one(`SELECT ${TOKEN_COLS} FROM vip_tokens WHERE token=$1 FOR UPDATE`, [code]);
    if (!tk) return { ok: false, error: 'invalid' };
    if (tk.holder_id === toId) return { ok: false, error: 'same' };
    if (tk.uses >= tk.max_uses) return { ok: false, error: 'limit' };
    const now = new Date();
    const src = await t.one('SELECT paid_at, expired_at, is_active, plan FROM subscriptions WHERE user_id=$1 FOR UPDATE', [tk.holder_id]);
    const srcExp = src ? parseDb(src.expired_at) : null;
    if (!src || !src.is_active || src.plan !== 'vip' || !srcExp || srcExp <= now) return { ok: false, error: 'inactive' };
    const tgt = await t.one('SELECT expired_at, is_active, plan FROM subscriptions WHERE user_id=$1 FOR UPDATE', [toId]);
    if (tgt && tgt.is_active && tgt.plan === 'vip' && (parseDb(tgt.expired_at) || 0) > now) return { ok: false, error: 'target_active' };

    await t.run('UPDATE subscriptions SET is_active=0, expired_at=$1 WHERE user_id=$2', [toDb(now), tk.holder_id]);
    await t.run(
      `INSERT INTO subscriptions (user_id, plan, paid_at, expired_at, is_active, reminder_stage) VALUES ($1,'vip',$2,$3,1,0)
       ON CONFLICT(user_id) DO UPDATE SET paid_at=EXCLUDED.paid_at, expired_at=EXCLUDED.expired_at, is_active=1, plan='vip', reminder_stage=0`,
      [toId, src.paid_at, toDb(srcExp)]);
    await t.run('DELETE FROM vip_tokens WHERE holder_id=$1 AND token<>$2', [toId, tk.token]);
    await t.run('UPDATE vip_tokens SET holder_id=$1, uses=uses+1, updated_at=$2 WHERE token=$3', [toId, toDb(now), tk.token]);
    await t.run('INSERT INTO vip_token_log (token, from_id, to_id, created_at) VALUES ($1,$2,$3,$4)', [tk.token, tk.holder_id, toId, toDb(now)]);
    return { ok: true, token: tk.token, from_id: tk.holder_id, to_id: toId, expired: srcExp, uses: tk.uses + 1, max_uses: tk.max_uses };
  });
}

async function followTokenChain(d, uid, maxHops = 5) {
  let cur = uid; const seen = new Set([uid]);
  for (let i = 0; i < maxHops; i++) {
    const r = await d.one('SELECT to_id FROM vip_token_log WHERE from_id=$1 ORDER BY id DESC LIMIT 1', [cur]);
    if (!r || seen.has(r.to_id)) break;
    cur = r.to_id; seen.add(cur);
  }
  return cur;
}

function tokenNotice(tok) {
  if (!tok) return '';
  return `<b>Token VIP kamu</b>\n<code>${tok.token}</code>\n` +
    `Dipakai untuk memindahkan VIP ke akun Telegram lain (maksimal ${tok.max_uses} kali) jika akun ini terkena banned, tanpa perlu beli VIP lagi.\n` +
    '<b>Simpan kode ini sekarang</b> di tempat aman di luar akun Telegram ini, misalnya catatan HP atau password manager. ' +
    'Jika akun ini dibanned, kamu tidak bisa membuka kode ini lagi. Jangan bagikan ke siapa pun. ' +
    'Kode berganti dan pemakaian kembali ke 0 saat kamu membeli VIP periode berikutnya.';
}

// ── Pembatas tebakan kode (tersimpan di database, aman untuk serverless) ──────
let schemaReady;
function ensureSchema() {
  schemaReady = schemaReady || db.run(
    `CREATE TABLE IF NOT EXISTS web_attempts (user_id BIGINT PRIMARY KEY, fails INTEGER NOT NULL DEFAULT 0, window_start TEXT, locked_until TEXT)`
  ).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}
const MAX_FAILS = 6, FAIL_WINDOW_MS = 10 * 60000, LOCK_MS = 15 * 60000;

async function guarded(uid, fn) {
  await ensureSchema();
  const row = await db.one('SELECT fails, window_start, locked_until FROM web_attempts WHERE user_id=$1', [uid]);
  const lockedUntil = row && parseDb(row.locked_until);
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw err(429, `Terlalu banyak percobaan salah. Coba lagi dalam ${Math.ceil((lockedUntil - Date.now()) / 60000)} menit.`);
  }
  try {
    const r = await fn();
    if (row) await db.run('DELETE FROM web_attempts WHERE user_id=$1', [uid]);
    return r;
  } catch (e) {
    if (e.extra && e.extra.notFound) {
      const ws = row && parseDb(row.window_start);
      const inWindow = !!ws && Date.now() - ws.getTime() < FAIL_WINDOW_MS;
      let fails = inWindow ? row.fails + 1 : 1;
      let windowStart = inWindow ? row.window_start : isoNow(), locked = null;
      if (fails >= MAX_FAILS) { locked = toDb(new Date(Date.now() + LOCK_MS)); fails = 0; windowStart = null; }
      await db.run(
        `INSERT INTO web_attempts (user_id, fails, window_start, locked_until) VALUES ($1,$2,$3,$4)
         ON CONFLICT(user_id) DO UPDATE SET fails=EXCLUDED.fails, window_start=EXCLUDED.window_start, locked_until=EXCLUDED.locked_until`,
        [uid, fails, windowStart, locked]);
    }
    throw e;
  }
}

// ── Promo ────────────────────────────────────────────────────────────────────
const PROMO_COLS = 'id, code, percent, max_uses, expires_at, is_active';

function promoProblem(p, used, mine) {
  if (!p || !p.is_active) return err(400, 'Kode promo tidak ditemukan atau sudah tidak aktif.', { notFound: true });
  const exp = parseDb(p.expires_at);
  if (exp && exp <= new Date()) return err(400, 'Kode promo sudah kedaluwarsa.');
  if (p.max_uses && used >= p.max_uses) return err(400, 'Kuota kode promo sudah habis.');
  if (mine > 0) return err(400, 'Kamu sudah pernah memakai kode promo ini.');
  return null;
}

async function checkPromo(d, code, uid, lock = false) {
  const norm = U.normalizeCode(code);
  const p = norm ? await d.one(`SELECT ${PROMO_COLS} FROM promo_codes WHERE code=$1${lock ? ' FOR UPDATE' : ''}`, [norm]) : null;
  let used = 0, mine = 0;
  if (p) {
    const r = await d.one(
      `SELECT COUNT(*) AS used, COUNT(*) FILTER (WHERE user_id=$1) AS mine FROM orders WHERE promo_id=$2 AND status IN ${COUNTED}`, [uid, p.id]);
    used = r.used; mine = r.mine;
  }
  const problem = promoProblem(p, used, mine);
  if (problem) throw problem;
  return p;
}

// ── Pesanan ──────────────────────────────────────────────────────────────────
async function pickUniqueCode(d, price) {
  if ((await getSetting('pay_unique', '1', d)) !== '1') return 0;
  const taken = new Set((await d.q("SELECT total FROM orders WHERE status IN ('pending','verifying')")).map((r) => r.total));
  const codes = Array.from({ length: 99 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  return codes.find((c) => !taken.has(price + c)) || 0;
}

async function createOrder(uid, planId, promoCode) {
  const staticQris = await getSetting('pay_qris');
  const plan = await db.one('SELECT id, name, days, price, is_active FROM plans WHERE id=$1', [planId]);
  if (!plan || !plan.is_active || !staticQris) throw err(400, 'Paket tidak tersedia.');
  const res = await tx(async (t) => {
    const open = await t.one("SELECT id, status FROM orders WHERE user_id=$1 AND status IN ('pending','verifying') ORDER BY id DESC LIMIT 1", [uid]);
    if (open && open.status === 'verifying') throw err(409, `Pesanan #${open.id} sedang diverifikasi admin.`, { orderId: open.id });
    if (open) await t.run("UPDATE orders SET status='cancelled', updated_at=$1 WHERE id=$2 AND status='pending'", [isoNow(), open.id]);
    let promo = null, discount = 0, price = plan.price;
    if (promoCode) {
      promo = await checkPromo(t, promoCode, uid, true);
      [discount, price] = U.calcDiscount(plan.price, promo.percent);
    }
    const free = price <= 0;
    const unique = free ? 0 : await pickUniqueCode(t, price);
    const total = price + unique;
    let payload = '';
    if (!free) { try { payload = convertQris(staticQris, total); } catch (e) { throw err(500, 'QRIS pembayaran bermasalah: ' + e.message); } }
    const now = isoNow();
    const o = await t.one(
      `INSERT INTO orders (user_id, plan_id, plan_name, days, base_price, unique_code, total, status, qris_payload, created_at, updated_at, promo_id, promo_code, discount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$9,$10,$11,$12) RETURNING id`,
      [uid, plan.id, plan.name, plan.days, plan.price, unique, total, payload, now, promo ? promo.id : null, promo ? promo.code : null, promo ? discount : 0]);
    return { id: o.id, free, promo };
  });
  if (res.free) {
    const paid = await approveOrder(res.id, 0, 'promo', `Kode promo ${res.promo.code} (100%)`);
    if (paid) {
      await notifyPaid(paid);
      await tg.sendMessage(Number(process.env.ADMIN_ID), `<b>VIP gratis via promo 100%</b>\nUser: <code>${uid}</code>\nKode: ${esc(res.promo.code)}\nPesanan #${res.id}`);
    }
  }
  return res;
}

async function approveOrder(orderId, adminId, by = 'admin', note = null) {
  return tx(async (t) => {
    const o = await t.one(
      `UPDATE orders SET status='paid', paid_at=$1, updated_at=$1, handled_by=$2, verified_by=$3, verify_note=COALESCE($4, verify_note)
       WHERE id=$5 AND status IN ('pending','verifying','expired') RETURNING *`,
      [isoNow(), adminId, by, note, orderId]);
    if (!o) return null;
    o.new_expired = await extendSub(t, o.user_id, o.days);
    o.token = await issueToken(t, o.user_id);
    return o;
  });
}

async function notifyPaid(o) {
  const lines = ['<b>Pembayaran Dikonfirmasi</b>', `Paket: ${esc(o.plan_name)}`];
  if (o.discount) lines.push(`Diskon: -${rp(o.discount)} (${esc(o.promo_code)})`);
  lines.push(`Total: ${rp(o.total)}`, `VIP s/d: <b>${U.fmtDt(o.new_expired)}</b>`,
    'Sesi Telegram kamu akan aktif otomatis dalam beberapa menit. Jika belum pernah setup, buka Mini App lalu pilih Setup.', tokenNotice(o.token), 'Terima kasih.');
  return tg.sendMessage(o.user_id, lines.filter(Boolean).join('\n'));
}

async function rejectOrder(orderId, adminId) {
  const o = await db.one(
    "UPDATE orders SET status='rejected', updated_at=$1, handled_by=$2 WHERE id=$3 AND status IN ('pending','verifying') RETURNING *",
    [isoNow(), adminId, orderId]);
  if (!o) return null;
  await tg.sendMessage(o.user_id, `<b>Pembayaran Ditolak</b>\nPesanan <b>#${o.id}</b> tidak dapat diverifikasi (bukti tidak valid atau dana belum masuk). ` +
    `Jika merasa ini keliru, hubungi admin ${esc(process.env.ADMIN_CONTACT || '')} dengan bukti transfer.`);
  return o;
}

async function revokePaidOrder(orderId, adminId, blockAuto) {
  const out = await tx(async (t) => {
    const o = await t.one("UPDATE orders SET status='revoked', updated_at=$1, handled_by=$2 WHERE id=$3 AND status='paid' RETURNING *", [isoNow(), adminId, orderId]);
    if (!o) return null;
    const live = (r) => { const s = subState(r); return isLiveVip(s); };
    let uid = o.user_id;
    let row = await t.one('SELECT expired_at, is_active, plan FROM subscriptions WHERE user_id=$1', [uid]);
    if (!live(row)) {                       // VIP mungkin sudah dipindah lewat token: ikuti rantainya
      const holder = await followTokenChain(t, uid);
      if (holder !== uid) { uid = holder; row = await t.one('SELECT expired_at, is_active, plan FROM subscriptions WHERE user_id=$1', [uid]); }
    }
    const r = { order: o, holder: uid, deactivated: false, newExpired: null };
    if (row && row.is_active && row.plan === 'vip') {
      const now = new Date();
      const cur = parseDb(row.expired_at) || now;
      const ne = addDays(cur, -o.days);
      if (ne <= now) { await t.run('UPDATE subscriptions SET is_active=0, expired_at=$1 WHERE user_id=$2', [toDb(now), uid]); r.deactivated = true; }
      else await t.run('UPDATE subscriptions SET expired_at=$1, reminder_stage=0 WHERE user_id=$2', [toDb(ne), uid]);
      r.newExpired = ne;
    }
    if (blockAuto) {
      const cur = new Set(String(await getSetting('pay_manual_users', '', t)).split(',').filter((x) => /^\d+$/.test(x)));
      cur.add(String(o.user_id));
      await setSetting('pay_manual_users', [...cur].join(','), t);
    }
    return r;
  });
  if (out) await tg.sendMessage(out.order.user_id, `<b>Pembayaran Dibatalkan</b>\nPesanan <b>#${out.order.id}</b> dibatalkan oleh admin karena pembayaran tidak dapat divalidasi. ` +
    `Jika merasa ini keliru, hubungi admin ${esc(process.env.ADMIN_CONTACT || '')} dengan bukti transfer asli.`);
  return out;
}

// ── Voucher ──────────────────────────────────────────────────────────────────
async function claimVoucher(code, uid) {
  const norm = U.normalizeCode(code);
  const res = await tx(async (t) => {
    const v = norm ? await t.one('SELECT id, code, days, max_claims, expires_at, is_active FROM vouchers WHERE code=$1 FOR UPDATE', [norm]) : null;
    if (!v || !v.is_active) throw err(400, 'Kode voucher tidak ditemukan atau sudah tidak aktif.', { notFound: true });
    const exp = parseDb(v.expires_at);
    if (exp && exp <= new Date()) throw err(400, 'Kode voucher sudah kedaluwarsa.');
    const c = await t.one('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE user_id=$1) AS mine FROM voucher_claims WHERE voucher_id=$2', [uid, v.id]);
    if (c.mine) throw err(400, 'Kamu sudah pernah mengklaim voucher ini.');
    if (v.max_claims && c.total >= v.max_claims) throw err(400, 'Voucher ini sudah habis diklaim.');
    await t.run('INSERT INTO voucher_claims (voucher_id, user_id, claimed_at) VALUES ($1,$2,$3)', [v.id, uid, isoNow()]);
    return { code: v.code, days: v.days, expired: await extendSub(t, uid, v.days) };
  });
  res.token = await issueToken(db, uid);
  return res;
}

// ── Trial ────────────────────────────────────────────────────────────────────
async function activateTrial(uid) {
  const minutes = parseInt(process.env.TRIAL_MINUTES || '5', 10) || 5;
  return tx(async (t) => {
    const u = await t.one('SELECT trial_used FROM users WHERE user_id=$1 FOR UPDATE', [uid]);
    if (u && u.trial_used) throw err(409, 'Trial sudah pernah digunakan.');
    if (subState(await getSubRow(uid, t)).state === 'active') throw err(409, 'Akun ini sudah punya langganan aktif.');
    const now = new Date(), exp = new Date(now.getTime() + minutes * 60000);
    await t.run('UPDATE users SET trial_used=1 WHERE user_id=$1', [uid]);
    await t.run(
      `INSERT INTO subscriptions (user_id, plan, paid_at, expired_at, is_active) VALUES ($1,'trial',$2,$3,1)
       ON CONFLICT(user_id) DO UPDATE SET paid_at=EXCLUDED.paid_at, expired_at=EXCLUDED.expired_at, is_active=1, plan='trial'`,
      [uid, toDb(now), toDb(exp)]);
    return { minutes, expired: exp };
  });
}

// ── Statistik ────────────────────────────────────────────────────────────────
async function getStats() {
  const now = isoNow();
  const wib = new Date(Date.now() + 7 * 3600e3); wib.setUTCHours(0, 0, 0, 0);
  const todayUtc = toDb(new Date(wib.getTime() - 7 * 3600e3));
  const month = toDb(new Date(Date.now() - 30 * 86400e3));
  const soon = toDb(new Date(Date.now() + 3 * 86400e3));
  const n = async (sql, p = []) => (await db.one(sql, p)).n || 0;
  return {
    users: await n('SELECT COUNT(*) AS n FROM users'),
    vip_active: await n("SELECT COUNT(*) AS n FROM subscriptions WHERE is_active=1 AND plan='vip' AND expired_at > $1", [now]),
    trial_active: await n("SELECT COUNT(*) AS n FROM subscriptions WHERE is_active=1 AND plan='trial' AND expired_at > $1", [now]),
    vip_expired: await n("SELECT COUNT(*) AS n FROM subscriptions WHERE plan='vip' AND (is_active=0 OR expired_at <= $1)", [now]),
    vip_expiring: await n("SELECT COUNT(*) AS n FROM subscriptions WHERE is_active=1 AND plan='vip' AND expired_at > $1 AND expired_at <= $2", [now, soon]),
    sessions: await n('SELECT COUNT(*) AS n FROM sessions'),
    orders_pending: await n("SELECT COUNT(*) AS n FROM orders WHERE status='pending'"),
    orders_verifying: await n("SELECT COUNT(*) AS n FROM orders WHERE status='verifying'"),
    orders_paid: await n("SELECT COUNT(*) AS n FROM orders WHERE status='paid'"),
    revenue_today: await n("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status='paid' AND paid_at >= $1", [todayUtc]),
    revenue_30d: await n("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status='paid' AND paid_at >= $1", [month]),
    revenue_total: await n("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status='paid'"),
  };
}

module.exports = {
  MAX_TOKEN_USES, getSetting, setSetting, expireMinutes, upsertUser, getSubRow, subState, isLiveVip, extendSub, requireActive,
  getToken, issueToken, ensureToken, transferByToken, tokenNotice, guarded, checkPromo, createOrder, approveOrder, notifyPaid,
  rejectOrder, revokePaidOrder, claimVoucher, activateTrial, getStats, validateQris, summarizeQris, err,
};
