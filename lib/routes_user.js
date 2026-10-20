const crypto = require('crypto');
const { db } = require('./db');
const core = require('./core');
const tg = require('./tg');
const qr = require('./qr');
const U = require('./util');
const { convertQris } = require('./qris');

const { err } = core;
const adminChat = () => Number(process.env.ADMIN_ID);
const days = (ms) => Math.ceil(ms / 86400000);

async function getOrder(uid, id) {
  const o = await db.one('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [Number(id), uid]);
  if (!o) throw err(404, 'Pesanan tidak ditemukan.');
  return o;
}

async function publicOrder(o, withQr) {
  const deadline = new Date(U.parseDb(o.created_at).getTime() + (await core.expireMinutes()) * 60000);
  if (o.status === 'pending' && deadline.getTime() < Date.now()) {          // kedaluwarsa dikunci saat dilihat
    await db.run("UPDATE orders SET status='expired', updated_at=$1 WHERE id=$2 AND status='pending'", [U.isoNow(), o.id]);
    o.status = 'expired';
  }
  const out = {
    id: o.id, plan_name: o.plan_name, days: o.days, base_price: o.base_price, discount: o.discount || 0, promo_code: o.promo_code,
    unique_code: o.unique_code, total: o.total, status: o.status, created_at: o.created_at, paid_at: o.paid_at, deadline: U.toDb(deadline),
  };
  if (withQr && o.status === 'pending' && o.qris_payload) out.qr = await qr(o.qris_payload);
  return out;
}

const TOKEN_ERRORS = {
  invalid: 'Token tidak ditemukan. Periksa kembali kodenya.',
  same: 'Token ini sudah terpasang di akun ini.',
  limit: 'Token ini sudah dipakai sampai batas maksimal. Beli VIP periode berikutnya untuk mendapatkan token baru.',
  inactive: 'VIP pada token ini sudah habis atau tidak aktif, jadi tidak bisa dipindahkan.',
  target_active: 'Akun ini masih punya VIP aktif. Token hanya bisa dipakai di akun tanpa VIP aktif.',
};

module.exports = [
  ['GET', 'me', async ({ session }) => {
    const uid = session.uid;
    const [u, subRow, sess, qrow, ust, bl, ab] = await Promise.all([
      db.one('SELECT user_id, username, full_name, created_at, trial_used FROM users WHERE user_id=$1', [uid]),
      core.getSubRow(uid),
      db.one('SELECT 1 AS ok FROM sessions WHERE user_id=$1', [uid]),
      db.one('SELECT qris_string, merchant_name, merchant_city FROM user_qris WHERE user_id=$1', [uid]),
      db.one('SELECT auto_dl_view_once FROM user_settings WHERE user_id=$1', [uid]),
      db.q('SELECT group_id, group_name FROM bc_group_blacklist WHERE user_id=$1 ORDER BY added_at DESC', [uid]),
      db.q('SELECT channel_id, channel_name FROM auto_block_channels WHERE user_id=$1', [uid]),
    ]);
    const st = core.subState(subRow);
    const token = core.isLiveVip(st) ? await core.ensureToken(uid) : null;
    return {
      user: { id: uid, name: u && u.full_name, username: u && u.username, created_at: u && u.created_at },
      sub: { state: st.state, plan: st.plan, expired_at: st.expired ? U.toDb(st.expired) : null, remaining_days: days(st.remainingMs), remaining_ms: st.remainingMs },
      token, hasSession: !!sess, trialUsed: !!(u && u.trial_used), autoDl: !!(ust && ust.auto_dl_view_once),
      qris: qrow ? { merchant: qrow.merchant_name, city: qrow.merchant_city } : null,
      bcBlacklist: bl, autoBlock: ab, contact: process.env.ADMIN_CONTACT || '',
    };
  }],

  ['GET', 'shop', async ({ session }) => {
    const [plans, qrisSet, open] = await Promise.all([
      db.q('SELECT id, name, days, price FROM plans WHERE is_active=1 ORDER BY days ASC, id ASC'),
      core.getSetting('pay_qris'),
      db.one("SELECT id, status, total FROM orders WHERE user_id=$1 AND status IN ('pending','verifying') ORDER BY id DESC LIMIT 1", [session.uid]),
    ]);
    return { ready: !!qrisSet && plans.length > 0, plans, openOrder: open, expireMinutes: await core.expireMinutes() };
  }],

  ['POST', 'promo/check', async ({ session, body }) => {
    const p = await core.guarded(session.uid, () => core.checkPromo(db, body.code, session.uid));
    return { code: p.code, percent: p.percent };
  }],

  ['POST', 'orders', async ({ session, body }) => {
    const planId = Number(body.planId);
    if (!Number.isInteger(planId)) throw err(400, 'Paket tidak valid.');
    const make = () => core.createOrder(session.uid, planId, body.promo ? String(body.promo) : null);
    const r = await (body.promo ? core.guarded(session.uid, make) : make());
    return { id: r.id, free: r.free };
  }],

  ['GET', 'orders', async ({ session }) => {
    const rows = await db.q(
      'SELECT id, plan_name, days, total, status, created_at, discount, promo_code FROM orders WHERE user_id=$1 ORDER BY id DESC LIMIT 30', [session.uid]);
    return { orders: rows };
  }],

  ['GET', 'orders/:id', async ({ session, params }) => {
    const o = await getOrder(session.uid, params.id);
    const out = await publicOrder(o, true);
    if (out.status === 'paid') out.token = await core.getToken(session.uid);
    return { order: out };
  }],

  ['POST', 'orders/:id/cancel', async ({ session, params }) => {
    const n = await db.run("UPDATE orders SET status='cancelled', updated_at=$1 WHERE id=$2 AND user_id=$3 AND status='pending'", [U.isoNow(), Number(params.id), session.uid]);
    if (!n) throw err(409, 'Pesanan tidak bisa dibatalkan (sudah diproses).');
    return { ok: true };
  }],

  ['POST', 'orders/:id/proof', async ({ session, params, body }) => {
    const o = await getOrder(session.uid, params.id);
    if (!['pending', 'verifying'].includes(o.status)) throw err(409, 'Pesanan ini sudah tidak menerima bukti bayar.');
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
    if (!m) throw err(400, 'Kirim bukti dalam bentuk gambar JPG atau PNG.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 1000 || buf.length > 3_500_000) throw err(400, 'Ukuran gambar harus di bawah 3,5 MB.');
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const dup = await db.one("SELECT id, user_id, status FROM orders WHERE proof_hash=$1 AND id<>$2 AND status IN ('verifying','paid','rejected','revoked') ORDER BY id DESC LIMIT 1", [hash, o.id]);
    const note = dup ? `Gambar bukti IDENTIK dengan order #${dup.id} (user ${dup.user_id}, status ${dup.status}), kemungkinan bukti dipakai ulang.` : null;
    const u = await db.one('SELECT full_name, username FROM users WHERE user_id=$1', [session.uid]);
    const caption = [
      '<b>Pembayaran masuk (via Mini App), cek mutasi</b>', `Order #${o.id}`,
      `User: <a href="tg://user?id=${session.uid}">${U.esc(u && u.full_name)}</a>${u && u.username ? ' (@' + U.esc(u.username) + ')' : ''} - <code>${session.uid}</code>`,
      `Paket: ${U.esc(o.plan_name)} (${o.days} hari)`, o.discount ? `Diskon: -${U.rp(o.discount)} (${U.esc(o.promo_code)})` : '',
      `Total: <b>${U.rp(o.total)}</b>`, note ? `Catatan sistem: ${U.esc(note)}` : '',
      `Pastikan dana ${U.rp(o.total)} sudah masuk, lalu tekan Approve.`,
    ].filter(Boolean).join('\n');
    let fileId;
    try {
      fileId = await tg.sendPhoto(adminChat(), buf, caption, { inline_keyboard: [[
        { text: 'Approve', callback_data: `admin_ord_ok_${o.id}` }, { text: 'Tolak', callback_data: `admin_ord_no_${o.id}` }]] });
    } catch (e) { console.error('[proof]', e.message); throw err(502, 'Bukti gagal dikirim ke admin. Coba lagi sebentar lagi.'); }
    const n = await db.run(
      "UPDATE orders SET proof_file_id=$1, proof_hash=$2, status='verifying', verify_note=COALESCE($3, verify_note), updated_at=$4 WHERE id=$5 AND status IN ('pending','verifying')",
      ['photo:' + fileId, hash, note, U.isoNow(), o.id]);
    if (!n) throw err(409, 'Pesanan sudah diproses.');
    return { ok: true };
  }],

  ['POST', 'token/redeem', async ({ session, body }) => {
    const code = U.normalizeToken(body.code);
    if (!code) throw err(400, 'Format token tidak valid. Contoh: RMS-ABCD-EFGH-JKLM', { notFound: true });
    const r = await core.guarded(session.uid, async () => {
      const x = await core.transferByToken(code, session.uid);
      if (!x.ok) throw err(x.error === 'invalid' ? 400 : 409, TOKEN_ERRORS[x.error], x.error === 'invalid' ? { notFound: true } : undefined);
      return x;
    });
    tg.sendMessage(r.from_id, `VIP akun ini telah dipindahkan ke akun lain menggunakan token. Jika bukan kamu yang melakukannya, segera hubungi admin ${U.esc(process.env.ADMIN_CONTACT || '')}.`);
    tg.sendMessage(adminChat(), `<b>Token dipakai (Mini App)</b>\nDari: <code>${r.from_id}</code>\nKe: <code>${session.uid}</code>\nPemakaian: ${r.uses}/${r.max_uses}\nVIP s/d ${U.fmtDt(r.expired)}`);
    return { expired: U.toDb(r.expired), uses: r.uses, max_uses: r.max_uses, token: r.token };
  }],

  ['POST', 'voucher/claim', async ({ session, body }) => {
    const r = await core.guarded(session.uid, () => core.claimVoucher(body.code, session.uid));
    return { days: r.days, expired: U.toDb(r.expired), token: r.token };
  }],

  ['POST', 'trial', async ({ session }) => {
    const r = await core.activateTrial(session.uid);
    return { minutes: r.minutes, expired: U.toDb(r.expired) };
  }],

  ['POST', 'settings', async ({ session, body }) => {
    await core.requireActive(session.uid);
    await db.run(
      'INSERT INTO user_settings (user_id, auto_dl_view_once) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET auto_dl_view_once=EXCLUDED.auto_dl_view_once',
      [session.uid, body.autoDl ? 1 : 0]);
    return { autoDl: !!body.autoDl };
  }],

  ['POST', 'qris/save', async ({ session, body }) => {
    await core.requireActive(session.uid);
    const qrisStr = String(body.qris || '').trim();
    const errors = core.validateQris(qrisStr);
    if (errors.length) throw err(400, errors[0]);
    const s = core.summarizeQris(qrisStr);
    await db.run(
      `INSERT INTO user_qris (user_id, qris_string, merchant_name, merchant_city, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(user_id) DO UPDATE SET qris_string=EXCLUDED.qris_string, merchant_name=EXCLUDED.merchant_name, merchant_city=EXCLUDED.merchant_city, updated_at=EXCLUDED.updated_at`,
      [session.uid, qrisStr, s.merchant_name, s.merchant_city, U.isoNow()]);
    return { merchant: s.merchant_name, city: s.merchant_city };
  }],

  ['POST', 'qris/delete', async ({ session }) => {
    await db.run('DELETE FROM user_qris WHERE user_id=$1', [session.uid]);
    return { ok: true };
  }],

  ['POST', 'qris/generate', async ({ session, body }) => {
    await core.requireActive(session.uid);
    const row = await db.one('SELECT qris_string, merchant_name FROM user_qris WHERE user_id=$1', [session.uid]);
    if (!row) throw err(400, 'Simpan QRIS statis kamu dulu.');
    const amount = U.int(String(body.amount ?? '').replace(/[^\d]/g, ''), null, 1, 999_999_999);
    if (!amount) throw err(400, 'Nominal tidak valid.');
    return { svg: await qr(convertQris(row.qris_string, amount)), amount, merchant: row.merchant_name };
  }],

  ['POST', 'blacklist/remove', async ({ session, body }) => {
    await db.run('DELETE FROM bc_group_blacklist WHERE user_id=$1 AND group_id=$2', [session.uid, Number(body.groupId)]);
    return { ok: true };
  }],

  ['POST', 'autoblock/remove', async ({ session, body }) => {
    await db.run('DELETE FROM auto_block_channels WHERE user_id=$1 AND channel_id=$2', [session.uid, Number(body.channelId)]);
    return { ok: true };
  }],
];
