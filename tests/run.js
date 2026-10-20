// Tes tanpa dependensi: node tests/run.js
const assert = require('assert');
const crypto = require('crypto');

process.env.BOT_TOKEN = '123456:TEST-TOKEN';
process.env.ADMIN_ID = '777';
process.env.SESSION_SECRET = 'rahasia-tes';

const Q = require('../lib/qris');
const A = require('../lib/auth');
const U = require('../lib/util');

// ── QRIS ──
assert.strictEqual(Q.crc16('123456789'), '29B1');                       // vektor baku CRC-16/CCITT-FALSE
const tlv = (t, v) => t + String(v.length).padStart(2, '0') + v;
const body = tlv('00', '01') + tlv('01', '11') + tlv('26', tlv('00', 'ID.CO.TEST') + tlv('01', '936000') + tlv('02', 'ID1234')) +
  tlv('52', '5411') + tlv('53', '360') + tlv('58', 'ID') + tlv('59', 'TOKO TES') + tlv('60', 'JAKARTA') + '6304';
const STATIC = body + Q.crc16(body);
assert.deepStrictEqual(Q.validateQris(STATIC), []);
assert.ok(Q.validateQris(STATIC.slice(0, -1) + '0').length > 0);        // CRC rusak
assert.ok(Q.validateQris('abc')[0].includes('QRIS'));
assert.deepStrictEqual(Q.summarizeQris(STATIC), { merchant_name: 'TOKO TES', merchant_city: 'JAKARTA' });
const dyn = Q.convertQris(STATIC, 25046);
assert.deepStrictEqual(Q.validateQris(dyn), []);
const els = Object.fromEntries(Q.parseTlv(dyn));
assert.strictEqual(els['01'], '12'); assert.strictEqual(els['54'], '25046');
assert.ok(dyn.indexOf('5405') < dyn.indexOf('5802'));                    // tag 54 disisipkan sebelum tag 58
assert.strictEqual(Q.parseTlv(Q.convertQris(dyn, 1000)).filter(([t]) => t === '54').length, 1); // konversi ulang tidak menggandakan tag 54
assert.throws(() => Q.convertQris(STATIC, 0)); assert.throws(() => Q.convertQris(STATIC, 1.5));
assert.throws(() => Q.convertQris(STATIC, 1_000_000_000));

// ── Util ──
const t = U.generateToken();
assert.ok(/^RMS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(t));
assert.strictEqual(U.normalizeToken(t.toLowerCase().replace(/-/g, ' ')), t);
assert.strictEqual(U.normalizeToken('RMS-RMSA-BCDE-FGHJ'), 'RMS-RMSA-BCDE-FGHJ');
assert.strictEqual(U.normalizeToken('RMSABCDEFGHJ'), 'RMS-RMSA-BCDE-FGHJ');
assert.strictEqual(U.normalizeToken('RMS-ABCD-EFGH-JKL0'), null);
assert.strictEqual(U.normalizeCode(' hemat20 '), 'HEMAT20'); assert.strictEqual(U.normalizeCode('a!'), null);
assert.strictEqual(U.parsePercent('20%'), 20); assert.strictEqual(U.parsePercent('0'), null); assert.strictEqual(U.parsePercent('101'), null);
assert.deepStrictEqual(U.calcDiscount(25000, 20), [5000, 20000]);
assert.deepStrictEqual(U.calcDiscount(25000, 100), [25000, 0]);
assert.deepStrictEqual(U.calcDiscount(9999, 33), [3299, 6700]);
assert.strictEqual(U.int('5', 0, 1, 10), 5); assert.strictEqual(U.int('', 7, 1, 10), 7); assert.strictEqual(U.int('11', 0, 1, 10), null);
// format waktu harus naive (tanpa Z) agar kompatibel dengan datetime.fromisoformat Python
assert.ok(!U.isoNow().endsWith('Z'));
assert.strictEqual(U.parseDb('2026-10-20T07:25:00.123456').toISOString(), '2026-10-20T07:25:00.123Z');
assert.strictEqual(U.fmtDt(U.parseDb('2026-10-20T07:25:00')), '20 Okt 2026, 14:25 WIB');

// ── Login Telegram (initData) ──
function makeInitData(fields, token = process.env.BOT_TOKEN) {
  const p = new URLSearchParams(fields);
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return p.toString();
}
const now = Math.floor(Date.now() / 1000);
const user = JSON.stringify({ id: 4242, first_name: 'Budi', username: 'budi' });
const good = makeInitData({ auth_date: String(now), query_id: 'AAH', user, start_param: 'x' });
const ok = A.validateInitData(good);
assert.strictEqual(ok.user.id, 4242); assert.strictEqual(ok.startParam, 'x');
assert.throws(() => A.validateInitData(good.replace('Budi', 'Eve')), /cocok/);                     // data diubah
assert.throws(() => A.validateInitData(makeInitData({ auth_date: String(now), user }, 'token:lain')), /cocok/);
assert.throws(() => A.validateInitData(makeInitData({ auth_date: String(now - 90000), user })), /kedaluwarsa/);
assert.throws(() => A.validateInitData(makeInitData({ auth_date: String(now + 4000), user })), /kedaluwarsa/);
assert.throws(() => A.validateInitData(''), /tidak valid/);
assert.throws(() => A.validateInitData('hash=' + 'a'.repeat(64)), /cocok|tidak valid/);

// ── Sesi ──
const s = A.signSession(4242, false);
assert.deepStrictEqual(A.verifySession(s), { uid: 4242, adm: false });
assert.strictEqual(A.verifySession(s.slice(0, -2) + 'AA'), null);                                   // tanda tangan diubah
assert.strictEqual(A.verifySession(s, Date.now() + 9 * 3600e3), null);                              // kedaluwarsa (8 jam)
assert.strictEqual(A.verifySession(A.signSession(777, true)).adm, true);
assert.strictEqual(A.verifySession(A.signSession(4242, true)).adm, false);                          // flag admin diabaikan bila bukan ADMIN_ID
const forged = Buffer.from(JSON.stringify({ uid: 4242, adm: 1, exp: Date.now() + 1e6 })).toString('base64url') + '.' + s.split('.')[1];
assert.strictEqual(A.verifySession(forged), null);                                                  // payload dipalsukan
assert.strictEqual(A.verifySession('sampah'), null);
console.log('semua tes lolos');
