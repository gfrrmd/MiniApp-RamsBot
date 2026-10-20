// Semua rute di sini diawali "admin/" dan hanya dilayani untuk admin (non-admin mendapat 404).
const { db } = require('./db');
const core = require('./core');
const tg = require('./tg');
const U = require('./util');
const { convertQris } = require('./qris');

const { err } = core;
const PAGE = 15;
const adminId = (s) => s.uid;
const optIso = (d) => (d ? U.toDb(U.addDays(new Date(), d)) : null);

const ORDER_LIST = `SELECT o.id, o.user_id, o.plan_name, o.total, o.status, o.created_at, o.verified_by, u.full_name
                    FROM orders o LEFT JOIN users u ON u.user_id=o.user_id`;
const STATUS_GROUPS = { open: ['pending', 'verifying'], paid: ['paid'], rejected: ['rejected', 'cancelled', 'expired', 'revoked'] };

async function userCard(uid) {
  const [u, sub, tok, log, sess, paid] = await Promise.all([
    db.one('SELECT user_id, username, full_name, created_at, trial_used FROM users WHERE user_id=$1', [uid]),
    core.getSubRow(uid), core.getToken(uid),
    db.q('SELECT from_id, to_id, created_at FROM vip_token_log WHERE from_id=$1 OR to_id=$1 ORDER BY id DESC LIMIT 5', [uid]),
    db.one('SELECT 1 AS ok FROM sessions WHERE user_id=$1', [uid]),
    db.one("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS sum FROM orders WHERE user_id=$1 AND status='paid'", [uid]),
  ]);
  if (!u && !sub) return null;
  const st = core.subState(sub);
  return {
    id: uid, name: u && u.full_name, username: u && u.username, created_at: u && u.created_at, trial_used: !!(u && u.trial_used),
    state: st.state, plan: st.plan, expired_at: st.expired ? U.toDb(st.expired) : null, remaining_ms: st.remainingMs,
    token: tok, tokenLog: log, hasSession: !!sess, paidOrders: paid.n, paidTotal: paid.sum,
  };
}

const setActive = (table) => async ({ params, body }) => {
  const id = Number(params.id);
  if (body.delete) {
    if (table === 'vouchers') await db.run('DELETE FROM voucher_claims WHERE voucher_id=$1', [id]);
    await db.run(`DELETE FROM ${table} WHERE id=$1`, [id]);
  } else {
    await db.run(`UPDATE ${table} SET is_active=$1 WHERE id=$2`, [body.active ? 1 : 0, id]);
  }
  return { ok: true };
};

module.exports = [
  ['GET', 'stats', async () => ({ stats: await core.getStats() })],

  // ── Pesanan ──
  ['GET', 'orders', async ({ query }) => {
    const group = STATUS_GROUPS[query.status];
    const page = Math.max(0, parseInt(query.page, 10) || 0);
    const where = group ? `WHERE o.status IN (${group.map((_, i) => '$' + (i + 1)).join(',')})` : '';
    const rows = await db.q(`${ORDER_LIST} ${where} ORDER BY o.id DESC LIMIT ${PAGE + 1} OFFSET ${page * PAGE}`, group || []);
    return { orders: rows.slice(0, PAGE), more: rows.length > PAGE };
  }],
  ['GET', 'orders/:id', async ({ params }) => {
    const o = await db.one('SELECT * FROM orders WHERE id=$1', [Number(params.id)]);
    if (!o) throw err(404, 'Order tidak ditemukan.');
    delete o.qris_payload;
    const card = await userCard(o.user_id);
    return { order: { ...o, hasProof: !!o.proof_file_id }, user: card };
  }],
  ['GET', 'orders/:id/proof', async ({ params }) => {
    const o = await db.one('SELECT proof_file_id FROM orders WHERE id=$1', [Number(params.id)]);
    const [kind, , fileId] = String(o && o.proof_file_id || '').split(/(:)/);
    if (!fileId) throw err(404, 'Belum ada bukti bayar.');
    try { const f = await tg.fetchFile(fileId); return { raw: f.buf, type: f.type }; }
    catch (e) { throw err(502, 'Gagal mengambil bukti dari Telegram.'); }
  }],
  ['POST', 'orders/:id/approve', async ({ params, session }) => {
    const o = await core.approveOrder(Number(params.id), adminId(session), 'admin');
    if (!o) throw err(409, 'Order sudah diproses sebelumnya.');
    await core.notifyPaid(o);
    return { ok: true, expired: U.toDb(o.new_expired) };
  }],
  ['POST', 'orders/:id/reject', async ({ params, session }) => {
    if (!(await core.rejectOrder(Number(params.id), adminId(session)))) throw err(409, 'Order sudah diproses sebelumnya.');
    return { ok: true };
  }],
  ['POST', 'orders/:id/revoke', async ({ params, body, session }) => {
    const r = await core.revokePaidOrder(Number(params.id), adminId(session), !!body.block);
    if (!r) throw err(409, 'Order tidak berstatus Lunas.');
    return { ok: true, deactivated: r.deactivated, holder: r.holder, newExpired: r.newExpired ? U.toDb(r.newExpired) : null };
  }],

  // ── Paket ──
  ['GET', 'plans', async () => ({ plans: await db.q('SELECT id, name, days, price, is_active FROM plans ORDER BY days ASC, id ASC') })],
  ['POST', 'plans', async ({ body }) => {
    const name = String(body.name || '').trim().slice(0, 40), d = U.int(body.days, null, 1, 3650), price = U.int(body.price, null, 0, 999_999_999);
    if (!name || d === null || price === null) throw err(400, 'Nama, durasi (1-3650 hari), dan harga wajib valid.');
    await db.run('INSERT INTO plans (name, days, price, is_active, created_at) VALUES ($1,$2,$3,1,$4)', [name, d, price, U.isoNow()]);
    return { ok: true };
  }],
  ['POST', 'plans/:id', async ({ params, body }) => {
    const id = Number(params.id);
    if (body.delete) await db.run('DELETE FROM plans WHERE id=$1', [id]);
    else if (body.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 40), d = U.int(body.days, null, 1, 3650), price = U.int(body.price, null, 0, 999_999_999);
      if (!name || d === null || price === null) throw err(400, 'Nama, durasi, dan harga wajib valid.');
      await db.run('UPDATE plans SET name=$1, days=$2, price=$3 WHERE id=$4', [name, d, price, id]);
    } else await db.run('UPDATE plans SET is_active=$1 WHERE id=$2', [body.active ? 1 : 0, id]);
    return { ok: true };
  }],

  // ── Promo ──
  ['GET', 'promos', async () => ({ promos: await db.q(
    `SELECT p.id, p.code, p.percent, p.max_uses, p.expires_at, p.is_active,
       (SELECT COUNT(*) FROM orders o WHERE o.promo_id=p.id AND o.status IN ('pending','verifying','paid','revoked')) AS used
     FROM promo_codes p ORDER BY p.id DESC LIMIT 100`) })],
  ['POST', 'promos', async ({ body }) => {
    const raw = String(body.code || '').trim();
    const code = /^(acak|random)$/i.test(raw) ? U.randCode(8) : U.normalizeCode(raw);
    const percent = U.parsePercent(body.percent), quota = U.int(body.quota, 0, 0, 1_000_000), valid = U.int(body.validDays, 0, 0, 3650);
    if (!code || !percent || quota === null || valid === null) throw err(400, 'Kode 3-20 karakter (huruf, angka, _ atau -), persen 1-100.');
    try {
      await db.run('INSERT INTO promo_codes (code, percent, max_uses, expires_at, is_active, created_at) VALUES ($1,$2,$3,$4,1,$5)', [code, percent, quota, optIso(valid), U.isoNow()]);
    } catch (e) { if (e.code === '23505' || /UNIQUE/i.test(e.message)) throw err(409, `Kode ${code} sudah ada.`); throw e; }
    return { code };
  }],
  ['POST', 'promos/:id', setActive('promo_codes')],

  // ── Voucher ──
  ['GET', 'vouchers', async () => ({ vouchers: await db.q(
    `SELECT v.id, v.code, v.days, v.max_claims, v.expires_at, v.is_active,
       (SELECT COUNT(*) FROM voucher_claims c WHERE c.voucher_id=v.id) AS claimed
     FROM vouchers v ORDER BY v.id DESC LIMIT 100`) })],
  ['POST', 'vouchers', async ({ body }) => {
    const raw = String(body.code || '').trim();
    const code = /^(acak|random)$/i.test(raw) ? U.randCode(10) : U.normalizeCode(raw);
    const d = U.int(body.days, null, 1, 3650), quota = U.int(body.quota, 1, 0, 1_000_000), valid = U.int(body.validDays, 0, 0, 3650);
    if (!code || d === null || quota === null || valid === null) throw err(400, 'Kode 3-20 karakter dan hari VIP 1-3650 wajib valid.');
    try {
      await db.run('INSERT INTO vouchers (code, days, max_claims, expires_at, is_active, created_at) VALUES ($1,$2,$3,$4,1,$5)', [code, d, quota, optIso(valid), U.isoNow()]);
    } catch (e) { if (e.code === '23505' || /UNIQUE/i.test(e.message)) throw err(409, `Kode ${code} sudah ada.`); throw e; }
    return { code };
  }],
  ['POST', 'vouchers/bulk', async ({ body }) => {
    const d = U.int(body.days, null, 1, 3650), count = U.int(body.count, null, 1, 50), valid = U.int(body.validDays, 0, 0, 3650);
    if (d === null || count === null || valid === null) throw err(400, 'Hari VIP 1-3650 dan jumlah 1-50 wajib valid.');
    const codes = [];
    while (codes.length < count) {
      const code = U.randCode(10);
      const n = await db.run('INSERT INTO vouchers (code, days, max_claims, expires_at, is_active, created_at) VALUES ($1,$2,1,$3,1,$4) ON CONFLICT(code) DO NOTHING', [code, d, optIso(valid), U.isoNow()]);
      if (n) codes.push(code);
    }
    return { codes };
  }],
  ['POST', 'vouchers/:id', setActive('vouchers')],

  // ── User ──
  ['GET', 'users', async ({ query }) => {
    const q = String(query.q || '').trim().replace(/^@/, '');
    let rows;
    if (/^-?\d+$/.test(q)) rows = await db.q('SELECT user_id, username, full_name FROM users WHERE user_id=$1', [Number(q)]);
    else if (q) rows = await db.q('SELECT user_id, username, full_name FROM users WHERE LOWER(username) LIKE $1 OR LOWER(full_name) LIKE $1 ORDER BY created_at DESC LIMIT 20', [`%${q.toLowerCase()}%`]);
    else rows = await db.q('SELECT user_id, username, full_name FROM users ORDER BY created_at DESC LIMIT 20');
    return { users: rows };
  }],
  ['GET', 'users/:id', async ({ params }) => {
    const card = await userCard(Number(params.id));
    if (!card) throw err(404, 'User tidak ditemukan.');
    return { user: card };
  }],
  ['POST', 'users/:id/extend', async ({ params, body }) => {
    const uid = Number(params.id), d = U.int(body.days, null, 1, 3650);
    if (d === null) throw err(400, 'Jumlah hari 1-3650.');
    await db.run('INSERT INTO users (user_id, created_at) VALUES ($1,$2) ON CONFLICT(user_id) DO NOTHING', [uid, U.isoNow()]);
    const exp = await core.extendSub(db, uid, d);
    await tg.sendMessage(uid, `<b>VIP kamu ditambah ${d} hari.</b>\nAktif hingga <b>${U.fmtDt(exp)}</b>.`);
    return { expired: U.toDb(exp) };
  }],
  ['POST', 'users/:id/revoke', async ({ params }) => {
    const uid = Number(params.id);
    if (!(await db.run('UPDATE subscriptions SET is_active=0 WHERE user_id=$1 AND is_active=1', [uid]))) throw err(409, 'User tidak punya langganan aktif.');
    await tg.sendMessage(uid, `<b>VIP kamu telah dicabut oleh admin.</b>\nHubungi admin ${U.esc(process.env.ADMIN_CONTACT || '')} jika ada pertanyaan.`);
    return { ok: true };
  }],
  ['POST', 'users/:id/token', async ({ params }) => {
    const uid = Number(params.id);
    if (!core.isLiveVip(core.subState(await core.getSubRow(uid)))) throw err(409, 'User tidak punya VIP aktif.');
    return { token: await core.issueToken(db, uid) };
  }],

  // ── Pengaturan pembayaran ──
  ['GET', 'settings', async () => {
    const q = await core.getSetting('pay_qris');
    return { qris: q ? core.summarizeQris(q) : null, unique: (await core.getSetting('pay_unique', '1')) === '1', expire: await core.expireMinutes() };
  }],
  ['POST', 'settings', async ({ body }) => {
    if (body.qris !== undefined) {
      const s = String(body.qris).trim(), errors = core.validateQris(s);
      if (errors.length) throw err(400, errors[0]);
      try { convertQris(s, 10000); } catch (e) { throw err(400, 'Tes konversi gagal: ' + e.message); }
      await core.setSetting('pay_qris', s);
    }
    if (body.unique !== undefined) await core.setSetting('pay_unique', body.unique ? '1' : '0');
    if (body.expire !== undefined) {
      const m = U.int(body.expire, null, 5, 1440);
      if (m === null) throw err(400, 'Batas waktu 5-1440 menit.');
      await core.setSetting('pay_expire_min', m);
    }
    return { ok: true };
  }],

  // ── Blacklist channel (.copy) ──
  ['GET', 'blacklist', async () => ({ items: await db.q('SELECT identifier, note, added_at FROM blacklist_channels ORDER BY added_at DESC LIMIT 200') })],
  ['POST', 'blacklist', async ({ body }) => {
    const id = String(body.identifier || '').trim().replace(/^@/, '');
    if (!id) throw err(400, 'Isi username atau ID channel.');
    await db.run('INSERT INTO blacklist_channels (identifier, note, added_at) VALUES ($1,$2,$3) ON CONFLICT(identifier) DO NOTHING', [id, String(body.note || '').slice(0, 100), U.isoNow()]);
    return { ok: true };
  }],
  ['POST', 'blacklist/remove', async ({ body }) => {
    await db.run('DELETE FROM blacklist_channels WHERE identifier=$1', [String(body.identifier || '').replace(/^@/, '')]);
    return { ok: true };
  }],

  // ── Pengumuman: dikirim per batch agar tidak melewati batas waktu fungsi ──
  ['POST', 'announce', async ({ body }) => {
    const text = String(body.text || '').trim();
    if (!text || text.length > 3500) throw err(400, 'Isi pesan 1-3500 karakter.');
    const offset = Math.max(0, parseInt(body.offset, 10) || 0), BATCH = 25;
    const total = (await db.one('SELECT COUNT(*) AS n FROM users')).n;
    const ids = await db.q('SELECT user_id FROM users ORDER BY user_id LIMIT $1 OFFSET $2', [BATCH, offset]);
    let sent = 0;
    for (const r of ids) {
      if (await tg.sendMessage(r.user_id, U.esc(text))) sent++;
      await new Promise((ok) => setTimeout(ok, 40));
    }
    const next = offset + ids.length;
    return { sent, failed: ids.length - sent, next: next < total ? next : null, total };
  }],
];
