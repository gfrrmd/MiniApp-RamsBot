const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

// Database bot menyimpan waktu sebagai ISO naive UTC (tanpa 'Z'). Python fromisoformat gagal
// membandingkan datetime ber-timezone dengan naive, jadi format ini HARUS dipertahankan.
const isoNow = () => new Date().toISOString().replace('Z', '');
const toDb = (d) => d.toISOString().replace('Z', '');
function parseDb(s) {
  if (!s) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtDt(v) {   // "20 Okt 2026, 14:25 WIB"
  const d = v instanceof Date ? v : parseDb(v);
  if (!d) return '-';
  const w = new Date(d.getTime() + 7 * 3600e3);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(w.getUTCDate())} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${p2(w.getUTCHours())}:${p2(w.getUTCMinutes())} WIB`;
}

const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Kode: tanpa I, O, 0, 1 (sama dengan bot)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
const generateToken = () => { const r = randCode(12); return `RMS-${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8)}`; };
function normalizeToken(text) {
  let s = String(text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (s.length === 15 && s.startsWith('RMS')) s = s.slice(3);
  if (s.length !== 12 || [...s].some((ch) => !ALPHABET.includes(ch))) return null;
  return `RMS-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
function normalizeCode(text) {
  const s = String(text || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{3,20}$/.test(s) ? s : null;
}
function parsePercent(v) {
  const m = /^\s*(\d{1,3})\s*%?\s*$/.exec(String(v ?? ''));
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 100 ? n : null;
}
function calcDiscount(price, percent) {
  const discount = Math.max(0, Math.min(price, Math.floor((price * percent) / 100)));
  return [discount, price - discount];
}

// Angka bulat opsional: kosong -> def, di luar rentang -> null
function int(v, def, lo, hi) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) return null;
  return n;
}

module.exports = {
  HttpError, isoNow, toDb, parseDb, addDays, fmtDt, rp, esc, randCode, generateToken, normalizeToken,
  normalizeCode, parsePercent, calcDiscount, int,
};
