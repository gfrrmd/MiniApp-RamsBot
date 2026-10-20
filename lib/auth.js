const crypto = require('crypto');
const { HttpError } = require('./util');

const botToken = () => process.env.BOT_TOKEN || '';
const adminId = () => Number(process.env.ADMIN_ID || 0);
const sessionSecret = () =>
  process.env.SESSION_SECRET || crypto.createHash('sha256').update('ramsbot-session:' + botToken()).digest('hex');

const b64 = (b) => Buffer.from(b).toString('base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data);

// Validasi initData Telegram Mini App sesuai dokumentasi resmi:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function validateInitData(initData, maxAgeSec = 86400, now = Date.now()) {
  if (!botToken()) throw new HttpError(500, 'BOT_TOKEN belum diatur di server');
  if (!initData || typeof initData !== 'string' || initData.length > 4096) throw new HttpError(401, 'Data login tidak valid');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw new HttpError(401, 'Data login tidak valid');
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = hmac('WebAppData', botToken()).digest();
  const calc = hmac(secret, check).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== calc.length || !crypto.timingSafeEqual(given, calc)) throw new HttpError(401, 'Tanda tangan login tidak cocok');
  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > maxAgeSec || authDate - now / 1000 > 300) throw new HttpError(401, 'Sesi Telegram kedaluwarsa, buka ulang aplikasi');
  let user;
  try { user = JSON.parse(params.get('user') || ''); } catch (_) { user = null; }
  if (!user || !Number.isInteger(user.id)) throw new HttpError(401, 'Data pengguna tidak ditemukan');
  return { user, startParam: params.get('start_param') || '' };
}

function signSession(uid, isAdmin, now = Date.now()) {
  const ttl = isAdmin ? 2 * 3600 * 1000 : 8 * 3600 * 1000;
  const body = b64(JSON.stringify({ uid, adm: isAdmin ? 1 : 0, exp: now + ttl }));
  return `${body}.${b64(hmac(sessionSecret(), body).digest())}`;
}

function verifySession(token, now = Date.now()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = hmac(sessionSecret(), body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== good.length || !crypto.timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.uid || p.exp < now) return null;
    return { uid: p.uid, adm: !!p.adm && p.uid === adminId() };
  } catch (_) { return null; }
}

function getSession(req) {
  const h = req.headers.authorization || '';
  const s = h.startsWith('Bearer ') ? verifySession(h.slice(7)) : null;
  if (!s) throw new HttpError(401, 'Sesi berakhir, masuk ulang');
  return s;
}

const isAdminId = (uid) => adminId() !== 0 && uid === adminId();

module.exports = { validateInitData, signSession, verifySession, getSession, isAdminId };
