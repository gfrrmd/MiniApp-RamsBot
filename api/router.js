// Satu fungsi serverless untuk seluruh API (hemat batas fungsi Vercel). Rewrite di vercel.json
// mengirim /api/* ke sini dengan query ?route=<path>.
const { HttpError } = require('../lib/util');
const { getSession, validateInitData, signSession, isAdminId } = require('../lib/auth');
const core = require('../lib/core');

const userRoutes = require('../lib/routes_user');
const adminRoutes = require('../lib/routes_admin');

const compile = (list, admin) => list.map(([method, pattern, handler]) => {
  const keys = [];
  const re = new RegExp('^' + (admin ? 'admin/' : '') + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { method, re, keys, handler, admin };
});
const ROUTES = [...compile(userRoutes, false), ...compile(adminRoutes, true)];

function routeOf(req) {
  let r = req.query && req.query.route;
  if (Array.isArray(r)) r = r.join('/');
  if (r == null) r = new URL(req.url, 'http://x').pathname.replace(/^\/api\/?/, '');
  return String(r).replace(/^\/+|\/+$/g, '');
}

const send = (res, status, data) => { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8'); res.send(JSON.stringify(data)); };

module.exports = async (req, res) => {
  try {
    const path = routeOf(req);
    const method = req.method;
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body && typeof body === 'object' ? body : {};

    if (method === 'GET' && path === 'config') {
      return send(res, 200, { bot: process.env.BOT_USERNAME || '', brand: process.env.BRAND_NAME || 'RamsBot', contact: process.env.ADMIN_CONTACT || '' });
    }
    if (method === 'POST' && path === 'auth') {
      const { user, startParam } = validateInitData(body.initData);
      await core.upsertUser(user);
      const adm = isAdminId(user.id);
      return send(res, 200, { token: signSession(user.id, adm), startParam, isAdmin: adm,
        user: { id: user.id, name: [user.first_name, user.last_name].filter(Boolean).join(' '), username: user.username || null } });
    }

    const match = ROUTES.map((r) => ({ r, m: r.re.exec(path) })).find((x) => x.m && x.r.method === method);
    if (!match) throw new HttpError(404, 'Not found');
    const session = getSession(req);
    // Rute admin berpura-pura tidak ada bagi non-admin.
    if (match.r.admin && !session.adm) throw new HttpError(404, 'Not found');
    const params = Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m[i + 1])]));
    const query = { ...(req.query || {}), ...Object.fromEntries(new URL(req.url, 'http://x').searchParams) };
    delete query.route;
    const out = await match.r.handler({ req, body, params, query, session });
    if (out && out.raw) { res.status(200).setHeader('Content-Type', out.type); return res.send(out.raw); }
    return send(res, 200, out);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[api]', e);
    send(res, status, { error: e.status ? e.message : 'Terjadi kesalahan pada server', ...(e.extra && e.extra.orderId ? { orderId: e.extra.orderId } : {}) });
  }
};
