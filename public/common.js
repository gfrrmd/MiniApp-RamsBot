/* Util bersama untuk Mini App dan Console. Tanpa framework, tanpa emoji. */
(function () {
  'use strict';
  const tg = window.Telegram && window.Telegram.WebApp;
  const RB = (window.RB = { tg, token: null, user: null, startParam: '', isAdmin: false });

  RB.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RB.rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  // Waktu di database = ISO naive UTC. Tampilkan dalam WIB.
  RB.parse = (s) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z') : null);
  RB.date = (s, withTime = true) => {
    const d = RB.parse(s); if (!d || isNaN(d)) return '-';
    return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) + (withTime ? ' WIB' : '');
  };
  RB.discount = (price, pct) => { const d = Math.max(0, Math.min(price, Math.floor((price * pct) / 100))); return [d, price - d]; };

  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.7-3.6 3.5-5.5 7-5.5s6.3 1.9 7 5.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    key: '<circle cx="8" cy="15" r="3.6"/><path d="m10.6 12.4 8.4-8.4M15.5 7.5l2.5 2.5M13 10l2 2"/>',
    ticket: '<path d="M3.5 9V7a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 7v2a2.5 2.5 0 0 0 0 5v3a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-3a2.5 2.5 0 0 0 0-5Z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>',
    tag: '<path d="M3.5 12.2V4.5h7.7l9 9a1.6 1.6 0 0 1 0 2.2l-5.5 5.5a1.6 1.6 0 0 1-2.2 0l-9-9Z"/><circle cx="8" cy="8.5" r="1.2"/>',
    shield: '<path d="M12 3.2 4.5 6v5.6c0 4.6 3 7.9 7.5 9.2 4.5-1.3 7.5-4.6 7.5-9.2V6L12 3.2Z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5M20 14v.01M14 20h2.5M20 17.5V20h-2"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4L17.5 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="m9.5 6 6 6-6 6"/>', refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    upload: '<path d="M12 16V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3-4.8 6-4.8s5.4 1.6 6 4.8"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M18.5 14.8c1.5.7 2.4 2 2.7 4"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="m7.5 15 3.5-4 3 2.5 4.5-6"/>', list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>',
    send: '<path d="m4 12 16-8-5.5 16-3-6.5L4 12Z"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    alert: '<path d="M12 4 3 19.5h18L12 4Z"/><path d="M12 10v4.5M12 17.3v.01"/>', link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
    play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z"/>', download: '<path d="M12 4.5V16M7.5 11.5 12 16l4.5-4.5"/><path d="M4.5 19.5h15"/>',
    bolt: '<path d="M13 3.5 5.5 13.5h5.5l-1 7 7.5-10h-5.5l1-7Z"/>', block: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  };
  RB.ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  RB.toast = (msg, type = '') => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; document.body.appendChild(t);
    if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.notificationOccurred(type === 'bad' ? 'error' : type === 'ok' ? 'success' : 'warning'); } catch (_) {} }
    setTimeout(() => t.remove(), 3200);
  };

  // Sheet (panel dari bawah). Tombol Back Telegram menutup sheet teratas.
  const stack = [];
  const syncBack = () => {
    if (!tg || !tg.BackButton) return;
    if (stack.length) tg.BackButton.show(); else tg.BackButton.hide();
  };
  if (tg && tg.BackButton) tg.BackButton.onClick(() => { const top = stack[stack.length - 1]; if (top) top.close(); });
  RB.sheet = (html, onClose) => {
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
    const entry = { el: bg.firstChild, close() { const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1); bg.classList.add('out'); setTimeout(() => bg.remove(), 190); syncBack(); if (onClose) onClose(); } };
    bg.addEventListener('click', (e) => { if (e.target === bg) entry.close(); });
    document.body.appendChild(bg); stack.push(entry); syncBack();
    return entry;
  };
  RB.confirm = (title, text, okLabel = 'Lanjutkan', danger = false) => new Promise((resolve) => {
    let done = false;
    const s = RB.sheet(`<h3 class="h1" style="font-size:20px">${RB.esc(title)}</h3><p class="mut sm" style="margin:8px 0 18px">${RB.esc(text)}</p>
      <div class="row"><button class="btn ghost grow" data-c="0">Batal</button><button class="btn ${danger ? 'danger' : ''} grow" data-c="1">${RB.esc(okLabel)}</button></div>`,
      () => { if (!done) resolve(false); });
    s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { done = true; resolve(b.dataset.c === '1'); s.close(); } });
  });
  RB.copy = async (text, label = 'Disalin') => {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
    RB.toast(label, 'ok');
  };

  // Event delegation: elemen dengan data-act="nama" memanggil handlers.nama(el, event)
  RB.bind = (root, handlers) => root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && handlers[el.dataset.act]) { e.preventDefault(); handlers[el.dataset.act](el, e); }
  });
  RB.busy = async (btn, fn) => {
    if (btn.disabled) return;
    const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
  };

  // ── API ──
  async function request(path, method, body, token) {
    const r = await fetch('/api/' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text(); let data = {};
    try { data = JSON.parse(text); } catch (_) { /* bukan JSON */ }
    return { status: r.status, data, raw: r };
  }
  RB.login = async () => {
    if (!tg || !tg.initData) throw new Error('Buka aplikasi ini lewat Telegram.');
    const { status, data } = await request('auth', 'POST', { initData: tg.initData });
    if (status !== 200) throw new Error(data.error || 'Login gagal');
    Object.assign(RB, { token: data.token, user: data.user, startParam: data.startParam || '', isAdmin: !!data.isAdmin });
    return data;
  };
  RB.api = async (path, opt = {}) => {
    const method = opt.method || (opt.body !== undefined ? 'POST' : 'GET');
    let res = await request(path, method, opt.body, RB.token);
    if (res.status === 401 && tg && tg.initData) { await RB.login(); res = await request(path, method, opt.body, RB.token); }
    if (res.status >= 400) { const e = new Error(res.data.error || 'Permintaan gagal'); e.status = res.status; e.data = res.data; throw e; }
    return res.data;
  };
  RB.blob = async (path) => {                       // untuk gambar yang butuh header Authorization
    const r = await fetch('/api/' + path, { headers: { Authorization: 'Bearer ' + RB.token } });
    if (!r.ok) throw new Error('Gagal memuat gambar');
    return URL.createObjectURL(await r.blob());
  };

  RB.theme = () => {
    if (!tg) return;
    try { tg.ready(); tg.expand(); tg.setHeaderColor('#09090b'); tg.setBackgroundColor('#09090b'); if (tg.setBottomBarColor) tg.setBottomBarColor('#09090b'); if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (_) {}
  };

  // Kecilkan foto bukti bayar agar muat batas 4,5 MB Vercel.
  RB.compress = (file) => new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.86, d; do { d = c.toDataURL('image/jpeg', q); q -= 0.1; } while (d.length > 4_300_000 && q > 0.3);
      URL.revokeObjectURL(url); resolve(d);
    };
    img.onerror = () => reject(new Error('Gambar tidak bisa dibaca. Pilih file JPG atau PNG.'));
    img.src = url;
  });

  RB.fail = (e) => RB.toast(e && e.message ? e.message : 'Terjadi kesalahan', 'bad');

  // ── Umpan balik sentuhan: ripple + getar halus (Haptic Telegram) ──
  RB.haptic = (kind = 'light') => { try { if (tg && tg.HapticFeedback) { if (kind === 'select') tg.HapticFeedback.selectionChanged(); else tg.HapticFeedback.impactOccurred(kind); } } catch (_) {} };
  const RIPPLE = '.btn,.quick,.item,.nav button,.mini button,.mod-h,.cmd,.plan,.seg button,.tabs button';
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest(RIPPLE);
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6, dot = document.createElement('span');
    dot.className = 'rp'; dot.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(dot); setTimeout(() => dot.remove(), 600);
    RB.haptic('light');
  }, { passive: true });
})();
