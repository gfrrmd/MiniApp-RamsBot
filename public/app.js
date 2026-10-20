(function () {
  'use strict';
  const { esc, rp, ico, tg } = RB;
  const root = document.getElementById('app');
  const S = { tab: 'home', me: null, shop: null, promo: null, cfg: { bot: '', brand: 'RamsBot', contact: '' } };

  const COMMANDS = [
    ['Media Timer dan View Once', '.dl', 'Balas pesan view once atau timer dengan perintah ini untuk menyimpannya. Aktifkan Auto DL di bawah agar tersimpan otomatis.'],
    ['Channel dan Grup Private', '.copy (link postingan)', 'Unduh pesan, foto, atau video dari channel atau grup yang dibatasi. Contoh: .copy https://t.me/koleksijee/456'],
    ['Story', '.story (link story)', 'Unduh story Telegram dari link-nya. Contoh: .story https://t.me/username/s/7'],
    ['Broadcast', '.bc (pesan)', 'Kirim pesan yang sama ke semua grup yang kamu ikuti. Batalkan dengan .cancel #task_id'],
    ['QRIS Dinamis', '.qris (nominal)', 'Ubah QRIS statis kamu menjadi dinamis di chat mana pun. Contoh: .qris 25000'],
    ['Auto Approve', '.acceptall (username atau link)', 'Setujui semua join request channel atau grup. Hentikan dengan .stopaccept'],
    ['Ping', '.ping', 'Kirim di Saved Messages untuk mengecek koneksi session.'],
  ];

  // ── Util tampilan ──
  const openBot = (param) => {
    const url = `https://t.me/${S.cfg.bot}${param ? '?start=' + param : ''}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
  };
  const openContact = () => { const c = String(S.cfg.contact || '').replace(/^@/, ''); if (c) (tg && tg.openTelegramLink ? tg.openTelegramLink('https://t.me/' + c) : window.open('https://t.me/' + c)); };
  const isActive = () => S.me && S.me.sub.state === 'active';
  const remainText = (sub) => {
    const ms = sub.remaining_ms;
    if (ms >= 86400000) return `${sub.remaining_days} hari tersisa`;
    if (ms >= 3600000) return `${Math.ceil(ms / 3600000)} jam tersisa`;
    return `${Math.max(1, Math.ceil(ms / 60000))} menit tersisa`;
  };
  const STATUS = {
    active: (s) => (s.plan === 'trial' ? ['Trial Aktif', 'warn'] : ['VIP Aktif', 'ok']),
    expired: () => ['Masa VIP Berakhir', 'bad'], revoked: () => ['Tidak Aktif', 'bad'], none: () => ['Belum Berlangganan', ''],
  };
  const ORDER_STATUS = {
    pending: ['Menunggu pembayaran', 'warn'], verifying: ['Diverifikasi admin', 'gold'], paid: ['Lunas', 'ok'],
    rejected: ['Ditolak', 'bad'], cancelled: ['Dibatalkan', ''], expired: ['Kedaluwarsa', ''], revoked: ['Dibatalkan admin', 'bad'],
  };
  const badge = (text, cls) => `<span class="badge ${cls || ''}"><i class="dot"></i>${esc(text)}</span>`;
  const note = (html, cls = '') => `<div class="note ${cls}">${ico('alert', 's')}<div>${html}</div></div>`;
  const loading = () => '<div class="sk"></div><div class="sk"></div><div class="sk" style="height:60px"></div>';

  const tokenBlock = (tok) => `
    <div class="label" style="margin-bottom:8px">Token VIP</div>
    <div class="token" id="tokenText">${esc(tok.token)}</div>
    <div class="segs">${Array.from({ length: tok.max_uses }, (_, i) => `<i class="${i < tok.uses ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row between sm mut" style="margin-top:8px"><span>Dipakai ${tok.uses} dari ${tok.max_uses} kali</span><span>Sisa ${Math.max(0, tok.max_uses - tok.uses)}</span></div>
    <button class="btn soft block" style="margin:12px 0" data-act="copytoken" data-v="${esc(tok.token)}">${ico('copy', 's')} Salin token</button>
    ${note('<b>Simpan kode ini sekarang</b> di tempat aman di luar akun Telegram ini, misalnya catatan HP atau password manager. Jika akun dibanned, kamu tidak bisa membuka kode ini lagi. Jangan bagikan ke siapa pun. Kode berganti dan pemakaian kembali ke 0 saat kamu membeli VIP periode berikutnya.')}`;

  // ── Kerangka ──
  const NAV = [['home', 'home', 'Beranda'], ['shop', 'bag', 'Beli VIP'], ['features', 'sliders', 'Fitur'], ['account', 'user', 'Akun']];
  function shell(body) {
    const name = (RB.user && RB.user.name) || 'U';
    root.innerHTML = `<div class="wrap"><div class="top"><span class="brand">${esc(S.cfg.brand)}</span><span class="avatar">${esc(name.trim().charAt(0).toUpperCase())}</span></div>${body}</div>
      <nav class="nav"><div>${NAV.map(([k, i, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${ico(i)}<span>${l}</span></button>`).join('')}</div></nav>`;
  }
  async function render() {
    if (S.tab === 'home') return shell(viewHome());
    if (S.tab === 'shop') { shell(loading()); try { S.shop = await RB.api('shop'); } catch (e) { RB.fail(e); } return S.tab === 'shop' && shell(viewShop()); }
    if (S.tab === 'features') return shell(viewFeatures());
    if (S.tab === 'account') return shell(viewAccount());
  }
  async function refresh(keepView) {
    S.me = await RB.api('me');
    if (!keepView) await render(); else if (S.tab !== 'shop') await render();
  }

  // ── Beranda ──
  function viewHome() {
    const m = S.me, sub = m.sub, [title, cls] = STATUS[sub.state](sub);
    const pct = sub.state === 'active' ? Math.min(100, Math.round((sub.remaining_ms / (30 * 86400000)) * 100)) : 0;
    const expiring = sub.state === 'active' && sub.plan === 'vip' && sub.remaining_ms < 3 * 86400000;
    return `
      <p class="mut" style="margin-bottom:4px">Selamat datang,</p>
      <h1 class="h1" style="margin-bottom:18px">${esc((RB.user && RB.user.name) || 'Pengguna')}</h1>
      <div class="card hero">
        <div class="row between"><span class="label">Keanggotaan</span>${badge(title, cls)}</div>
        <div class="big" style="margin-top:12px">${esc(title)}</div>
        <div class="mut sm" style="margin-top:4px">${sub.expired_at ? (sub.state === 'active' ? 'Berlaku hingga ' : 'Berakhir ') + esc(RB.date(sub.expired_at)) : 'Aktifkan VIP untuk memakai seluruh fitur.'}</div>
        ${sub.state === 'active' ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="sm mut" style="margin-top:8px">${esc(remainText(sub))}</div>` : ''}
        <button class="btn block" style="margin-top:16px" data-act="tab" data-tab="shop">${sub.state === 'active' ? 'Perpanjang VIP' : 'Beli VIP'}</button>
      </div>
      ${expiring ? note('VIP kamu hampir berakhir. Perpanjang sekarang, sisa hari akan otomatis ditambahkan.', '') : ''}
      <div class="card flat"><div class="row"><div class="tile">${ico('bolt')}</div><div class="grow"><div style="font-weight:600">Session Telegram</div>
        <div class="sm mut">${m.hasSession ? 'Tersimpan. Fitur berjalan di akun kamu.' : isActive() ? 'Belum disetel. Lakukan setup agar fitur aktif.' : 'Aktifkan VIP lebih dulu, lalu lakukan setup.'}</div></div>
        ${badge(m.hasSession ? 'Siap' : 'Belum', m.hasSession ? 'ok' : 'warn')}</div>
        <button class="btn ghost block" style="margin-top:14px" data-act="setup">${m.hasSession ? 'Atur ulang session lewat bot' : 'Setup lewat bot'}</button></div>
      <div class="h2">Akses cepat</div>
      <div class="grid2">
        <button class="quick" data-act="voucher"><span class="tile">${ico('ticket')}</span><span><b>Klaim Voucher</b><small>Tukar kode jadi VIP</small></span></button>
        <button class="quick" data-act="tokenpage"><span class="tile">${ico('key')}</span><span><b>Token VIP</b><small>Pindah akun tanpa beli</small></span></button>
        <button class="quick" data-act="orders"><span class="tile">${ico('list')}</span><span><b>Riwayat</b><small>Pesanan pembayaran</small></span></button>
        <button class="quick" data-act="tab" data-tab="features"><span class="tile">${ico('sliders')}</span><span><b>Fitur VIP</b><small>Pengaturan dan panduan</small></span></button>
      </div>`;
  }

  // ── Beli VIP ──
  function viewShop() {
    const sh = S.shop;
    if (!sh) return '<div class="empty">Gagal memuat paket.</div>';
    const promo = S.promo;
    const promoCard = promo
      ? `<div class="card flat row"><div class="tile">${ico('tag')}</div><div class="grow"><div style="font-weight:600">${esc(promo.code)}</div><div class="sm ok">Diskon ${promo.percent}% terpasang</div></div><button class="btn ghost sm" data-act="promoclear">Hapus</button></div>`
      : `<div class="card flat"><span class="label">Kode promo</span><div class="promo" style="margin-top:10px"><input class="input" id="promoIn" placeholder="Masukkan kode" autocomplete="off" autocapitalize="characters"><button class="btn soft" data-act="promoapply">Terapkan</button></div></div>`;
    const plans = sh.plans.map((p) => {
      const [, final] = promo ? RB.discount(p.price, promo.percent) : [0, p.price];
      return `<button class="plan" data-act="buy" data-id="${p.id}"><div><div class="n">${esc(p.name)}</div><div class="sm mut">${p.days} hari${p.days >= 7 ? ' - ' + rp(Math.round(final / p.days)) + ' per hari' : ''}</div></div>
        <div class="p">${promo ? `<s>${rp(p.price)}</s>` : ''}${final > 0 ? rp(final) : '<span class="gold">Gratis</span>'}</div></button>`;
    }).join('');
    return `<h1 class="h1">Pilih paket</h1><p class="mut sm" style="margin:6px 0 18px">Perpanjang sebelum habis, sisa hari otomatis ditambahkan.</p>
      ${sh.openOrder ? `<button class="item" data-act="vieworder" data-id="${sh.openOrder.id}"><span class="tile">${ico('clock')}</span><span class="grow"><div class="t">Pesanan #${sh.openOrder.id} belum selesai</div><div class="s">${esc(ORDER_STATUS[sh.openOrder.status][0])} - ${rp(sh.openOrder.total)}</div></span>${ico('chev', 's')}</button>` : ''}
      ${sh.ready ? promoCard + plans + note(`Bayar dengan QRIS (semua e-wallet dan m-banking), lalu unggah bukti bayar. Pesanan berlaku ${sh.expireMinutes} menit. Bot akan mengirim token VIP setelah pembayaran dikonfirmasi.`) : '<div class="empty">Pembayaran belum tersedia. Hubungi admin.</div>'}`;
  }

  // ── Fitur ──
  function viewFeatures() {
    const m = S.me, act = isActive();
    return `<h1 class="h1">Fitur VIP</h1><p class="mut sm" style="margin:6px 0 18px">Atur fitur akun kamu. Perintah dijalankan langsung dari Telegram.</p>
      ${act ? '' : `<div class="card flat" style="border-color:rgba(217,189,122,.25)"><div class="row"><div class="tile">${ico('lock')}</div><div class="grow"><b>Fitur terkunci</b><div class="sm mut">Aktifkan VIP untuk mengubah pengaturan.</div></div><button class="btn sm" data-act="tab" data-tab="shop">Beli</button></div></div>`}
      <div class="card"><div class="row"><div class="grow"><div style="font-weight:600">Auto Download View Once</div><div class="sm mut">Simpan otomatis media timer yang masuk ke chat kamu.</div></div><div class="switch ${m.autoDl ? 'on' : ''}" data-act="autodl" role="switch"></div></div></div>
      <div class="card"><div class="row" style="margin-bottom:12px"><div class="tile">${ico('qr')}</div><div class="grow"><div style="font-weight:600">QRIS Dinamis</div><div class="sm mut">${m.qris ? esc(m.qris.merchant || 'QRIS tersimpan') + (m.qris.city ? ' - ' + esc(m.qris.city) : '') : 'Simpan QRIS statis untuk membuat QR bernominal.'}</div></div></div>
        ${m.qris ? `<div class="promo"><input class="input" id="qrisAmt" inputmode="numeric" placeholder="Nominal, contoh 25000"><button class="btn" data-act="qrisgen">Buat QR</button></div>
          <div class="row" style="margin-top:10px"><button class="btn ghost sm grow" data-act="qrisedit">Ganti QRIS</button><button class="btn danger sm grow" data-act="qrisdel">Hapus</button></div>`
        : `<button class="btn ghost block" data-act="qrisedit">Simpan QRIS statis</button>`}</div>
      <div class="h2">Blacklist broadcast</div>
      ${m.bcBlacklist.length ? m.bcBlacklist.map((g) => `<div class="item" style="cursor:default"><span class="tile">${ico('block')}</span><span class="grow"><div class="t">${esc(g.group_name || g.group_id)}</div><div class="s mono">${esc(g.group_id)}</div></span><button class="btn ghost sm" data-act="bcrm" data-id="${esc(g.group_id)}">Hapus</button></div>`).join('') : '<div class="empty">Belum ada grup yang dikecualikan dari broadcast.</div>'}
      <div class="h2">Auto block leaver</div>
      ${m.autoBlock.length ? m.autoBlock.map((c) => `<div class="item" style="cursor:default"><span class="tile">${ico('shield')}</span><span class="grow"><div class="t">${esc(c.channel_name || c.channel_id)}</div><div class="s">Dipantau</div></span><button class="btn ghost sm" data-act="abrm" data-id="${esc(c.channel_id)}">Hentikan</button></div>`).join('') : '<div class="empty">Belum ada channel yang dipantau. Tambahkan channel lewat menu Auto Block Leaver di bot.</div>'}
      <div class="h2">Panduan perintah</div>
      ${COMMANDS.map(([t, c, d]) => `<div class="card flat"><div style="font-weight:600">${esc(t)}</div><div class="mono gold" style="margin:6px 0;font-size:13px">${esc(c)}</div><div class="sm mut">${esc(d)}</div></div>`).join('')}`;
  }

  // ── Akun ──
  function viewAccount() {
    const m = S.me, u = m.user;
    const tok = m.token;
    return `<h1 class="h1">Akun</h1>
      <div class="card" style="margin-top:18px"><div class="row"><span class="avatar" style="width:46px;height:46px;font-size:18px">${esc(String(u.name || 'U').trim().charAt(0).toUpperCase())}</span>
        <div class="grow"><div style="font-weight:650;font-size:16px">${esc(u.name || '-')}</div><div class="sm mut">${u.username ? '@' + esc(u.username) : 'Tanpa username'}</div></div></div>
        <div style="margin-top:12px"><div class="kv"><span>ID Telegram</span><span class="mono">${esc(u.id)}</span></div><div class="kv"><span>Bergabung</span><span>${esc(RB.date(u.created_at, false))}</span></div></div></div>
      ${tok ? `<div class="card">${tokenBlock(tok)}</div>` : ''}
      <div class="h2">Layanan</div>
      <button class="item" data-act="voucher"><span class="tile">${ico('ticket')}</span><span class="grow"><div class="t">Klaim voucher</div><div class="s">Tukar kode voucher menjadi masa VIP</div></span>${ico('chev', 's')}</button>
      ${isActive() ? '' : `<button class="item" data-act="tokenredeem"><span class="tile">${ico('key')}</span><span class="grow"><div class="t">Pindahkan VIP dengan token</div><div class="s">Akun lama terkena banned? Pakai token di sini</div></span>${ico('chev', 's')}</button>`}
      <button class="item" data-act="orders"><span class="tile">${ico('list')}</span><span class="grow"><div class="t">Riwayat pesanan</div><div class="s">Pembayaran dan status verifikasi</div></span>${ico('chev', 's')}</button>
      ${!m.trialUsed && !isActive() ? `<button class="item" data-act="trial"><span class="tile">${ico('play')}</span><span class="grow"><div class="t">Coba trial gratis</div><div class="s">Uji coba singkat sebelum membeli</div></span>${ico('chev', 's')}</button>` : ''}
      ${m.contact ? `<button class="item" data-act="contact"><span class="tile">${ico('send')}</span><span class="grow"><div class="t">Hubungi admin</div><div class="s">${esc(m.contact)}</div></span>${ico('chev', 's')}</button>` : ''}`;
  }

  // ── Sheet: input kode (voucher / token) ──
  function codeSheet({ title, desc, placeholder, button, path, hint }) {
    const s = RB.sheet(`<h3 class="h1" style="font-size:21px">${esc(title)}</h3><p class="mut sm" style="margin:8px 0 16px">${esc(desc)}</p>
      <input class="input" id="codeIn" placeholder="${esc(placeholder)}" autocomplete="off" autocapitalize="characters" spellcheck="false">
      ${hint ? `<p class="xs dim" style="margin:8px 2px 0">${esc(hint)}</p>` : ''}
      <button class="btn block" style="margin-top:16px" data-submit>${esc(button)}</button>`);
    const input = s.el.querySelector('#codeIn'), btn = s.el.querySelector('[data-submit]');
    setTimeout(() => input.focus(), 150);
    const go = () => RB.busy(btn, async () => {
      try { const r = await RB.api(path, { body: { code: input.value } }); s.close(); await refresh(); successSheet(path, r); }
      catch (e) { RB.fail(e); }
    });
    btn.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }
  function successSheet(path, r) {
    const redeem = path === 'token/redeem';
    const s = RB.sheet(`<div style="text-align:center;margin:4px 0 16px"><div class="tile" style="margin:0 auto 12px;width:54px;height:54px;border-radius:16px;color:var(--ok);background:rgba(98,209,160,.1);border-color:rgba(98,209,160,.3)">${ico('check')}</div>
      <h3 class="h1" style="font-size:21px">${redeem ? 'VIP berhasil dipindahkan' : 'Voucher berhasil diklaim'}</h3>
      <p class="mut sm" style="margin-top:6px">${redeem ? '' : `Tambahan ${r.days} hari. `}VIP aktif hingga <b style="color:var(--tx)">${esc(RB.date(r.expired))}</b></p></div>
      ${tokenBlock(redeem ? { token: r.token, uses: r.uses, max_uses: r.max_uses } : r.token)}
      <button class="btn block" style="margin-top:14px" data-done>${redeem ? 'Lanjut setup session' : 'Selesai'}</button>`);
    s.el.querySelector('[data-done]').addEventListener('click', () => { s.close(); if (redeem) openBot('setup'); });
    s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-act="copytoken"]'); if (b) RB.copy(b.dataset.v, 'Token disalin'); });
  }

  // ── Sheet: pesanan ──
  let poll = null;
  async function openOrder(id) {
    clearInterval(poll);
    const s = RB.sheet('<div class="sk"></div><div class="sk"></div>', () => clearInterval(poll));
    const load = async () => {
      let o;
      try { o = (await RB.api('orders/' + id)).order; } catch (e) { s.close(); return RB.fail(e); }
      if (!document.body.contains(s.el)) return;
      s.el.innerHTML = '<div class="grab"></div>' + orderHtml(o);
      wireOrder(s, o);
      if (!['pending', 'verifying'].includes(o.status)) { clearInterval(poll); if (o.status === 'paid') refresh(true); }
    };
    await load();
    poll = setInterval(load, 7000);
  }
  function orderHtml(o) {
    const [stText, stCls] = ORDER_STATUS[o.status] || [o.status, ''];
    const head = `<div class="row between" style="margin-bottom:14px"><h3 class="h1" style="font-size:20px">Pesanan #${o.id}</h3>${badge(stText, stCls)}</div>`;
    const kvs = `<div class="kv"><span>Paket</span><span>${esc(o.plan_name)} (${o.days} hari)</span></div><div class="kv"><span>Harga</span><span>${rp(o.base_price)}</span></div>
      ${o.discount ? `<div class="kv"><span>Diskon ${esc(o.promo_code)}</span><span class="ok">-${rp(o.discount)}</span></div>` : ''}
      ${o.unique_code ? `<div class="kv"><span>Kode unik</span><span>+${rp(o.unique_code)}</span></div>` : ''}`;
    if (o.status === 'pending') return `${head}${o.qr ? `<div class="qrbox">${o.qr}</div>` : ''}
      <div style="text-align:center;margin:16px 0"><div class="label">Total bayar</div><div class="big gold" style="margin-top:4px">${rp(o.total)}</div>
      <button class="btn ghost sm" style="margin-top:10px" data-copy="${o.total}">${ico('copy', 's')} Salin nominal</button></div>${kvs}
      <div class="kv"><span>Batas bayar</span><span>${esc(RB.date(o.deadline))}</span></div>
      <div style="margin:14px 0">${note('Bayar <b>tepat sesuai total</b> (termasuk kode unik), lalu unggah bukti bayar. Admin akan memverifikasi pesananmu.')}</div>
      <label class="btn block" style="cursor:pointer">${ico('upload', 's')} Unggah bukti bayar<input type="file" accept="image/*" hidden data-proof></label>
      <button class="btn danger block" style="margin-top:10px" data-cancel>Batalkan pesanan</button>`;
    if (o.status === 'verifying') return `${head}<div style="text-align:center;padding:10px 0 18px"><div class="spin" style="margin:0 auto 14px"></div><div style="font-weight:600">Menunggu verifikasi admin</div><div class="sm mut" style="margin-top:4px">Halaman ini diperbarui otomatis. Kamu juga akan menerima pesan dari bot.</div></div>${kvs}<div class="kv"><span>Total</span><span><b>${rp(o.total)}</b></span></div>
      <label class="btn ghost block" style="margin-top:14px;cursor:pointer">Kirim ulang bukti<input type="file" accept="image/*" hidden data-proof></label>`;
    if (o.status === 'paid') return `${head}<div style="text-align:center;margin:6px 0 16px"><div class="tile" style="margin:0 auto 12px;width:54px;height:54px;border-radius:16px;color:var(--ok);background:rgba(98,209,160,.1);border-color:rgba(98,209,160,.3)">${ico('check')}</div>
      <div style="font-weight:650;font-size:18px">Pembayaran berhasil</div><div class="sm mut" style="margin-top:4px">VIP kamu sudah aktif.</div></div>${kvs}<div class="kv"><span>Total</span><span><b>${rp(o.total)}</b></span></div>
      ${o.token ? `<div style="margin-top:16px">${tokenBlock(o.token)}</div>` : ''}<button class="btn block" style="margin-top:14px" data-close>Selesai</button>`;
    return `${head}${kvs}<div class="kv"><span>Total</span><span>${rp(o.total)}</span></div><button class="btn block" style="margin-top:16px" data-close data-shop>Kembali ke paket</button>`;
  }
  function wireOrder(s, o) {
    s.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { s.close(); if (b.hasAttribute('data-shop')) { S.tab = 'shop'; render(); } }));
    s.el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => RB.copy(b.dataset.copy, 'Nominal disalin')));
    s.el.querySelectorAll('[data-act="copytoken"]').forEach((b) => b.addEventListener('click', () => RB.copy(b.dataset.v, 'Token disalin')));
    const cancel = s.el.querySelector('[data-cancel]');
    if (cancel) cancel.addEventListener('click', async () => {
      if (!(await RB.confirm('Batalkan pesanan?', 'Pesanan ini akan dibatalkan dan QR tidak berlaku lagi.', 'Batalkan', true))) return;
      try { await RB.api(`orders/${o.id}/cancel`, { body: {} }); s.close(); RB.toast('Pesanan dibatalkan', 'ok'); render(); } catch (e) { RB.fail(e); }
    });
    const file = s.el.querySelector('[data-proof]');
    if (file) file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      const lbl = file.parentElement, old = lbl.innerHTML; lbl.style.opacity = '.6'; lbl.textContent = 'Mengunggah...';
      try { const image = await RB.compress(file.files[0]); await RB.api(`orders/${o.id}/proof`, { body: { image } }); RB.toast('Bukti terkirim ke admin', 'ok'); }
      catch (e) { RB.fail(e); lbl.innerHTML = old; lbl.style.opacity = ''; return openOrder(o.id); }
      clearInterval(poll); openOrder(o.id);
    });
  }

  // ── Aksi ──
  const ACT = {
    tab: (el) => { S.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
    setup: () => openBot('setup'),
    contact: openContact,
    copytoken: (el) => RB.copy(el.dataset.v, 'Token disalin'),
    vieworder: (el) => openOrder(el.dataset.id),
    tokenpage: () => { S.tab = 'account'; render(); window.scrollTo(0, 0); if (!S.me.token) ACT.tokenredeem(); },
    voucher: () => codeSheet({ title: 'Klaim voucher', desc: 'Masukkan kode voucher untuk menambah masa VIP.', placeholder: 'Kode voucher', button: 'Klaim sekarang', path: 'voucher/claim' }),
    tokenredeem: () => {
      if (isActive()) return RB.toast('Akun ini masih punya VIP aktif. Token hanya untuk akun tanpa VIP aktif.', 'bad');
      codeSheet({ title: 'Pindahkan VIP', desc: 'Masukkan token dari pembelian VIP sebelumnya. Sisa VIP akan pindah ke akun ini dan akun lama dinonaktifkan.', placeholder: 'RMS-XXXX-XXXX-XXXX', button: 'Pindahkan VIP', path: 'token/redeem', hint: 'Setiap token bisa dipakai maksimal 3 kali.' });
    },
    orders: async () => {
      const s = RB.sheet('<div class="sk"></div><div class="sk"></div>');
      try {
        const { orders } = await RB.api('orders');
        s.el.innerHTML = `<div class="grab"></div><h3 class="h1" style="font-size:20px;margin-bottom:14px">Riwayat pesanan</h3>` + (orders.length ? orders.map((o) => {
          const [t, c] = ORDER_STATUS[o.status] || [o.status, ''];
          return `<button class="item" data-oid="${o.id}"><span class="grow"><div class="t">${esc(o.plan_name)} - ${rp(o.total)}</div><div class="s">#${o.id} - ${esc(RB.date(o.created_at))}</div></span>${badge(t, c)}</button>`;
        }).join('') : '<div class="empty">Belum ada pesanan.</div>');
        s.el.querySelectorAll('[data-oid]').forEach((b) => b.addEventListener('click', () => { s.close(); openOrder(b.dataset.oid); }));
      } catch (e) { s.close(); RB.fail(e); }
    },
    trial: async (el) => RB.busy(el, async () => {
      try { const r = await RB.api('trial', { body: {} }); RB.toast(`Trial ${r.minutes} menit aktif`, 'ok'); await refresh(); } catch (e) { RB.fail(e); }
    }),
    promoapply: (el) => RB.busy(el, async () => {
      const code = document.getElementById('promoIn').value;
      try { S.promo = await RB.api('promo/check', { body: { code } }); RB.toast(`Diskon ${S.promo.percent}% terpasang`, 'ok'); } catch (e) { RB.fail(e); }
      if (S.tab === 'shop') shell(viewShop());
    }),
    promoclear: () => { S.promo = null; shell(viewShop()); },
    buy: (el) => RB.busy(el, async () => {
      try {
        const r = await RB.api('orders', { body: { planId: Number(el.dataset.id), promo: S.promo ? S.promo.code : undefined } });
        S.promo = null; if (r.free) await refresh(true);
        openOrder(r.id);
      } catch (e) {
        if (e.data && e.data.orderId) openOrder(e.data.orderId);
        if (/promo/i.test(e.message)) { S.promo = null; render(); }
        RB.fail(e);
      }
    }),
    autodl: async (el) => {
      const next = !el.classList.contains('on');
      try { await RB.api('settings', { body: { autoDl: next } }); el.classList.toggle('on', next); S.me.autoDl = next; RB.toast(next ? 'Auto DL aktif' : 'Auto DL nonaktif', 'ok'); } catch (e) { RB.fail(e); }
    },
    qrisedit: () => {
      const canScan = 'BarcodeDetector' in window;
      const s = RB.sheet(`<h3 class="h1" style="font-size:21px">QRIS statis</h3><p class="mut sm" style="margin:8px 0 14px">Tempel isi kode QRIS statis kamu (diawali 000201).${canScan ? ' Atau pindai dari gambar.' : ''}</p>
        <textarea class="input mono" id="qrisIn" placeholder="000201010211..." spellcheck="false"></textarea>
        ${canScan ? `<label class="btn ghost block" style="margin-top:10px;cursor:pointer">Pindai dari gambar<input type="file" accept="image/*" hidden id="qrisFile"></label>` : ''}
        <button class="btn block" style="margin-top:12px" data-save>Simpan</button>`);
      const area = s.el.querySelector('#qrisIn');
      const f = s.el.querySelector('#qrisFile');
      if (f) f.addEventListener('change', async () => {
        try { const bmp = await createImageBitmap(f.files[0]); const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(bmp); if (!r.length) throw new Error('QR tidak terbaca di gambar ini.'); area.value = r[0].rawValue; }
        catch (e) { RB.fail(e); }
      });
      const save = s.el.querySelector('[data-save]');
      save.addEventListener('click', () => RB.busy(save, async () => {
        try { await RB.api('qris/save', { body: { qris: area.value } }); s.close(); RB.toast('QRIS tersimpan', 'ok'); await refresh(); } catch (e) { RB.fail(e); }
      }));
    },
    qrisdel: async () => { if (await RB.confirm('Hapus QRIS?', 'QRIS statis yang tersimpan akan dihapus.', 'Hapus', true)) { try { await RB.api('qris/delete', { body: {} }); await refresh(); } catch (e) { RB.fail(e); } } },
    qrisgen: (el) => RB.busy(el, async () => {
      try {
        const r = await RB.api('qris/generate', { body: { amount: document.getElementById('qrisAmt').value } });
        RB.sheet(`<div style="text-align:center;margin-bottom:14px"><div class="label">${esc(r.merchant || 'QRIS Dinamis')}</div><div class="big gold" style="margin-top:4px">${rp(r.amount)}</div></div><div class="qrbox">${r.svg}</div>
          <p class="xs dim" style="text-align:center;margin-top:12px">Tahan lama pada QR lalu simpan gambar, atau tunjukkan langsung ke pembayar.</p>`);
      } catch (e) { RB.fail(e); }
    }),
    bcrm: async (el) => { try { await RB.api('blacklist/remove', { body: { groupId: el.dataset.id } }); await refresh(); } catch (e) { RB.fail(e); } },
    abrm: async (el) => { try { await RB.api('autoblock/remove', { body: { channelId: el.dataset.id } }); await refresh(); } catch (e) { RB.fail(e); } },
  };
  RB.bind(root, ACT);

  // ── Login & boot ──
  const screen = (html) => { root.innerHTML = `<div class="center">${html}</div>`; };
  function loginScreen(msg) {
    screen(`<span class="brand" style="font-size:13px">${esc(S.cfg.brand)}</span>
      <h1 class="h1" style="margin-top:6px">Masuk dengan Telegram</h1>
      <p class="mut sm" style="max-width:300px">Akunmu dikenali otomatis dari Telegram. Tidak perlu kata sandi.</p>
      ${msg ? `<div style="max-width:320px">${note(esc(msg), 'bad')}</div>` : '<div class="spin"></div>'}
      ${msg ? '<button class="btn" id="retry">Coba lagi</button>' : ''}`);
    const r = document.getElementById('retry'); if (r) r.addEventListener('click', boot);
  }
  async function boot() {
    try { const c = await fetch('/api/config').then((r) => r.json()); Object.assign(S.cfg, c); } catch (_) { /* pakai default */ }
    document.title = S.cfg.brand;
    if (!tg || !tg.initData) {
      return screen(`<span class="brand" style="font-size:13px">${esc(S.cfg.brand)}</span><h1 class="h1">Buka lewat Telegram</h1><p class="mut sm" style="max-width:300px">Halaman ini adalah Mini App dan hanya bisa dibuka dari dalam Telegram.</p>
        ${S.cfg.bot ? `<a class="btn" href="https://t.me/${esc(S.cfg.bot)}">Buka bot di Telegram</a>` : ''}`);
    }
    RB.theme(); loginScreen();
    try {
      await RB.login();
      if (RB.startParam === 'console' && RB.isAdmin) return location.replace('/console/');
      S.me = await RB.api('me');
      render();
    } catch (e) { loginScreen(e.message || 'Login gagal'); }
  }
  boot();
})();
