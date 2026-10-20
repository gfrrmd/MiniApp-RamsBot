// Pemanggil Bot API Telegram (notifikasi, kirim bukti ke admin, ambil file bukti).
const base = () => `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

async function call(method, body) {
  const r = await fetch(`${base()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram ${method} gagal`);
  return j.result;
}

// Tidak pernah melempar error: notifikasi gagal tidak boleh membatalkan transaksi.
async function sendMessage(chatId, text, extra = {}) {
  try {
    await call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
    return true;
  } catch (e) {
    console.warn('[tg] sendMessage gagal:', e.message);
    return false;
  }
}

// Kirim foto (Buffer) dan kembalikan file_id terbesar, sama seperti format bot ("photo:<file_id>").
async function sendPhoto(chatId, buf, caption, replyMarkup) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  form.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'bukti.jpg');
  const r = await fetch(`${base()}/sendPhoto`, { method: 'POST', body: form });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || 'Gagal mengirim foto');
  const sizes = j.result.photo || [];
  return sizes[sizes.length - 1].file_id;
}

async function fetchFile(fileId) {
  const info = await call('getFile', { file_id: fileId });
  const r = await fetch(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${info.file_path}`);
  if (!r.ok) throw new Error('File tidak ditemukan');
  const type = /\.png$/i.test(info.file_path) ? 'image/png' : 'image/jpeg';
  return { buf: Buffer.from(await r.arrayBuffer()), type };
}

module.exports = { call, sendMessage, sendPhoto, fetchFile };
