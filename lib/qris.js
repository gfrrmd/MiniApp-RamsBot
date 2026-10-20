// Port dari utils/qris.py (bot): konversi QRIS statis menjadi dinamis.
const MAX_AMOUNT = 999_999_999;

function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseTlv(data) {
  const out = [];
  let pos = 0;
  while (pos + 4 <= data.length) {
    const tag = data.slice(pos, pos + 2);
    const lenStr = data.slice(pos + 2, pos + 4);
    if (!/^\d{2}$/.test(lenStr)) break;
    const len = Number(lenStr);
    if (pos + 4 + len > data.length) break;
    out.push([tag, data.slice(pos + 4, pos + 4 + len)]);
    pos += 4 + len;
  }
  return out;
}
const buildTlv = (els) => els.map(([t, v]) => `${t}${String(v.length).padStart(2, '0')}${v}`).join('');

const REQUIRED = { '00': 'Payload Format Indicator', '01': 'Point of Initiation Method', '52': 'Merchant Category Code',
  '53': 'Transaction Currency', '58': 'Country Code', '59': 'Merchant Name', '60': 'Merchant City', '63': 'CRC' };

function validateQris(qris) {
  const s = String(qris || '').trim();
  if (!s) return ['Data QRIS kosong'];
  const errors = [];
  if (!s.startsWith('000201')) errors.push('Bukan format QRIS (harus diawali 000201)');
  if (s.length < 20) return [...errors, 'Data QRIS terlalu pendek'];
  if (s.slice(-4).toUpperCase() !== crc16(s.slice(0, -4))) errors.push('CRC tidak cocok, data QRIS rusak atau terpotong');
  const els = parseTlv(s);
  if (!els.length) return [...errors, 'Struktur QRIS tidak bisa dibaca'];
  const tags = new Set(els.map(([t]) => t));
  for (const [tag, name] of Object.entries(REQUIRED)) if (!tags.has(tag)) errors.push(`Tag wajib ${tag} (${name}) tidak ada`);
  const method = Object.fromEntries(els)['01'];
  if (method !== undefined && method !== '11' && method !== '12') errors.push(`Point of Initiation tidak valid: ${method}`);
  if (!els.some(([t]) => /^\d+$/.test(t) && Number(t) >= 26 && Number(t) <= 51)) errors.push('Merchant Account Information (tag 26-51) tidak ada');
  return errors;
}

function summarizeQris(qris) {
  const d = Object.fromEntries(parseTlv(String(qris || '').trim()));
  return { merchant_name: (d['59'] || '').trim(), merchant_city: (d['60'] || '').trim() };
}

function convertQris(staticQris, amount) {
  if (!Number.isInteger(amount) || amount < 1) throw new Error('Nominal tidak valid');
  if (amount > MAX_AMOUNT) throw new Error('Nominal terlalu besar');
  const els = parseTlv(String(staticQris).trim());
  if (!els.length) throw new Error('Struktur QRIS tidak bisa dibaca');
  const managed = new Set(['54', '55', '56', '57', '63']);
  const result = [];
  let inserted = false;
  for (const [tag, value] of els) {
    if (managed.has(tag)) continue;
    if (tag === '01') { result.push(['01', '12']); continue; }
    if (tag === '58' && !inserted) { result.push(['54', String(amount)]); inserted = true; }
    result.push([tag, value]);
  }
  if (!inserted) throw new Error('QRIS tidak memiliki tag Country Code (58)');
  const body = buildTlv(result) + '6304';
  return body + crc16(body);
}

module.exports = { crc16, parseTlv, validateQris, summarizeQris, convertQris };
