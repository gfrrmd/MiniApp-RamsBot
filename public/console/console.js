(function () {
  'use strict';
  const { esc, rp, ico, tg } = RB;
  const root = document.getElementById('app');
  const C = { tab: 'overview', filter: 'open' };

  const TABS = [['overview', 'Ringkasan', 'chart'], ['orders', 'Pesanan', 'list'], ['users', 'User', 'users'], ['plans', 'Paket', 'bag'], ['promos', 'Promo', 'tag'], ['vouchers', 'Voucher', 'ticket'], ['settings', 'Pembayaran', 'gear'], ['announce', 'Siaran', 'send'], ['blacklist', 'Blacklist', 'block']];
  const ST = { pending: ['Menunggu bayar', 'warn'], verifying: ['Perlu verifikasi', 'gold'], paid: ['Lunas', 'ok'], rejected: ['Ditolak', 'bad'], cancelled: ['Dibatalkan', ''], expired: ['Kedaluwarsa', ''], revoked: ['Dibatalkan admin', 'bad'] };
  const badge = (t, c) => `<span class="badge ${c || ''}"><i class="dot"></i>${esc(t)}</span>`;
  const note = (h, c = '') => `<div class="note ${c}">${ico('alert', 's')}<div>${h}</div></div>`;
  const loading = '<div class="sk"></div><div class="sk"></div><div class="sk" style="height:60px"></div>';
  const exp = (s) => (s ? esc(RB.date(s)) : 'Tanpa batas');

  function shell(body) {
    root.innerHTML = `<div class="wrap wide"><div class="top"><span class="brand">Dashboard Admin</span><span class="badge gold">${ico('shield', 's')} Admin</span></div>
      <div class="anav" role="tablist">${TABS.map(([k, l, i]) => `<button class="${C.tab === k ? 'on' : ''}" role="tab" aria-selected="${C.tab === k}" data-act="tab" data-tab="${k}">${ico(i)}<span>${l}</span></button>`).join('')}</div>
      <div id="pane" class="view">${body}</div></div>`;
  }
  const pane = (html) => { const p = document.getElementById('pane'); if (!p) return; p.innerHTML = html; p.classList.remove('view'); void p.offsetWidth; p.classList.add('view'); };

  // Sheet berisi form sederhana
  function formSheet(title, fields, label, onSubmit, desc) {
    const s = RB.sheet(`<h3 class="h1" style="font-size:20px">${esc(title)}</h3>${desc ? `<p class="mut sm" style="margin:8px 0 0">${desc}</p>` : ''}<div style="margin:16px 0">
      ${fields.map((f) => `<label class="field" style="margin-bottom:12px"><span>${esc(f.label)}</span>${f.area
        ? `<textarea class="input" name="${f.name}" placeholder="${esc(f.ph || '')}">${esc(f.value || '')}</textarea>`
        : `<input class="input" name="${f.name}" value="${esc(f.value ?? '')}" placeholder="${esc(f.ph || '')}" inputmode="${f.mode || 'text'}" autocomplete="off">`}</label>`).join('')}</div>
      <button class="btn block" data-go>${esc(label)}</button>`);
    const btn = s.el.querySelector('[data-go]');
    btn.addEventListener('click', () => RB.busy(btn, async () => {
      const v = {}; s.el.querySelectorAll('[name]').forEach((i) => { v[i.name] = i.value; });
      try { await onSubmit(v, s); } catch (e) { RB.fail(e); }
    }));
    return s;
  }
  const done = (s, msg) => { s.close(); if (msg) RB.toast(msg, 'ok'); return load(); };

  // ── Ringkasan ──
  async function vOverview() {
    const { stats: s } = await RB.api('admin/stats');
    const st = (l, v, c = '') => `<div class="stat"><span class="label">${l}</span><b class="${c}">${v}</b></div>`;
    pane(`<div class="grid2" style="margin-bottom:10px">${st('Pengguna', s.users)}${st('VIP aktif', s.vip_active, 'ok')}${st('Trial aktif', s.trial_active)}${st('Berakhir 3 hari', s.vip_expiring, 'warn')}${st('Session tersimpan', s.sessions)}${st('VIP berakhir', s.vip_expired)}</div>
      <button class="item" data-act="gotoorders"><span class="tile">${ico('list')}</span><span class="grow"><div class="t">${s.orders_verifying + s.orders_pending} pesanan aktif</div><div class="s">${s.orders_verifying} menunggu verifikasi, ${s.orders_pending} menunggu pembayaran</div></span>${ico('chev', 's')}</button>
      <div class="h2">Pendapatan</div><div class="grid2">${st('Hari ini', rp(s.revenue_today), 'gold')}${st('30 hari', rp(s.revenue_30d), 'gold')}</div>
      <div class="stat" style="margin-top:10px"><span class="label">Total (${s.orders_paid} pesanan lunas)</span><b class="gold">${rp(s.revenue_total)}</b></div>`);
  }

  // ── Pesanan ──
  const FILTERS = [['open', 'Perlu aksi'], ['paid', 'Lunas'], ['rejected', 'Gagal'], ['all', 'Semua']];
  async function vOrders(page = 0, append = false) {
    const r = await RB.api(`admin/orders?status=${C.filter}&page=${page}`);
    const list = r.orders.map((o) => { const [t, c] = ST[o.status] || [o.status, '']; return `<button class="item" data-act="order" data-id="${o.id}"><span class="grow"><div class="t">#${o.id} - ${esc(o.full_name || o.user_id)}</div><div class="s">${esc(o.plan_name)} - ${rp(o.total)} - ${esc(RB.date(o.created_at))}</div></span>${badge(t, c)}</button>`; }).join('');
    const more = r.more ? `<button class="btn ghost block" data-act="ordersmore" data-page="${page + 1}">Muat lagi</button>` : '';
    if (append) { document.getElementById('olist').insertAdjacentHTML('beforeend', list); const m = document.getElementById('omore'); m.innerHTML = more; return; }
    pane(`<div class="seg" role="tablist">${FILTERS.map(([k, l]) => `<button class="${C.filter === k ? 'on' : ''}" role="tab" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
      <div id="olist">${list || '<div class="empty">Tidak ada pesanan.</div>'}</div><div id="omore">${more}</div>`);
  }
  async function openOrder(id) {
    const s = RB.sheet(loading);
    try {
      const { order: o, user: u } = await RB.api('admin/orders/' + id);
      const [t, c] = ST[o.status] || [o.status, ''];
      const canAct = ['pending', 'verifying'].includes(o.status);
      s.el.innerHTML = `<div class="grab"></div><div class="row between" style="margin-bottom:12px"><h3 class="h1" style="font-size:20px">Pesanan #${o.id}</h3>${badge(t, c)}</div>
        <div class="kv"><span>User</span><span>${esc(u ? u.name : '-')} <span class="mono dim">${o.user_id}</span></span></div>
        <div class="kv"><span>Paket</span><span>${esc(o.plan_name)} (${o.days} hari)</span></div><div class="kv"><span>Harga</span><span>${rp(o.base_price)}</span></div>
        ${o.discount ? `<div class="kv"><span>Diskon ${esc(o.promo_code)}</span><span class="ok">-${rp(o.discount)}</span></div>` : ''}
        <div class="kv"><span>Kode unik</span><span>${o.unique_code ? '+' + rp(o.unique_code) : '-'}</span></div><div class="kv"><span>Total</span><span><b class="gold">${rp(o.total)}</b></span></div>
        <div class="kv"><span>Dibuat</span><span>${esc(RB.date(o.created_at))}</span></div>${o.paid_at ? `<div class="kv"><span>Dibayar</span><span>${esc(RB.date(o.paid_at))}</span></div>` : ''}
        ${o.verified_by ? `<div class="kv"><span>Diverifikasi</span><span>${esc({ auto: 'Otomatis (OCR)', promo: 'Promo 100%', admin: 'Admin' }[o.verified_by] || o.verified_by)}</span></div>` : ''}
        ${o.verify_note ? `<div style="margin-top:12px">${note(esc(o.verify_note), /IDENTIK|tidak/i.test(o.verify_note) ? 'bad' : '')}</div>` : ''}
        ${o.hasProof ? '<div id="proof" class="sm mut" style="margin-top:12px">Memuat bukti bayar...</div>' : '<div class="sm dim" style="margin-top:12px">Belum ada bukti bayar.</div>'}
        <div style="margin-top:16px" class="stack">
          ${canAct ? '<button class="btn block" data-a="approve">Setujui pembayaran</button><button class="btn danger block" data-a="reject">Tolak</button>' : ''}
          ${o.status === 'paid' ? '<button class="btn danger block" data-a="revoke">Batalkan pesanan lunas</button>' : ''}</div>`;
      if (o.hasProof) RB.blob(`admin/orders/${id}/proof`).then((url) => { const p = s.el.querySelector('#proof'); if (p) p.innerHTML = `<img class="imgp" src="${url}" alt="Bukti bayar">`; }).catch(() => { const p = s.el.querySelector('#proof'); if (p) p.textContent = 'Bukti tidak dapat dimuat.'; });
      s.el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
        const a = b.dataset.a;
        let block = false;
        if (a === 'approve' && !(await RB.confirm('Setujui pembayaran?', `Pastikan dana ${rp(o.total)} sudah masuk. VIP user langsung aktif.`, 'Setujui'))) return;
        if (a === 'reject' && !(await RB.confirm('Tolak pembayaran?', 'User akan diberi tahu.', 'Tolak', true))) return;
        if (a === 'revoke') { if (!(await RB.confirm('Batalkan pesanan lunas?', 'Hari VIP dari pesanan ini dikurangi (mengikuti pemegang VIP saat ini bila sudah dipindah lewat token).', 'Batalkan', true))) return; block = await RB.confirm('Wajibkan verifikasi manual?', 'Pembayaran user ini berikutnya harus diverifikasi manual (tanpa auto-approve).', 'Ya, wajibkan'); }
        RB.busy(b, async () => { try { const r = await RB.api(`admin/orders/${id}/${a}`, { body: { block } }); s.close(); RB.toast(a === 'approve' ? 'Pembayaran disetujui' : a === 'reject' ? 'Pembayaran ditolak' : r.deactivated ? 'Dibatalkan, VIP dinonaktifkan' : 'Dibatalkan, hari VIP dikurangi', 'ok'); load(); } catch (e) { RB.fail(e); } });
      }));
    } catch (e) { s.close(); RB.fail(e); }
  }

  // ── User ──
  async function vUsers(q = '') {
    const { users } = await RB.api('admin/users?q=' + encodeURIComponent(q));
    pane(`<div class="promo" style="margin-bottom:12px"><input class="input" id="uq" value="${esc(q)}" placeholder="Cari ID, username, atau nama"><button class="btn soft" data-act="usearch">${ico('search', 's')}</button></div>` +
      (users.length ? users.map((u) => `<button class="item" data-act="user" data-id="${u.user_id}"><span class="grow"><div class="t">${esc(u.full_name || u.user_id)}</div><div class="s">${u.username ? '@' + esc(u.username) + ' - ' : ''}<span class="mono">${u.user_id}</span></div></span>${ico('chev', 's')}</button>`).join('') : '<div class="empty">User tidak ditemukan.</div>'));
  }
  async function openUser(id) {
    const s = RB.sheet(loading);
    try {
      const { user: u } = await RB.api('admin/users/' + id);
      const stTxt = { active: u.plan === 'trial' ? ['Trial aktif', 'warn'] : ['VIP aktif', 'ok'], expired: ['Berakhir', 'bad'], revoked: ['Dicabut / dipindah', 'bad'], none: ['Belum berlangganan', ''] }[u.state];
      s.el.innerHTML = `<div class="grab"></div><div class="row between" style="margin-bottom:12px"><div><h3 class="h1" style="font-size:20px">${esc(u.name || u.id)}</h3><div class="sm mut">${u.username ? '@' + esc(u.username) + ' - ' : ''}<span class="mono">${u.id}</span></div></div>${badge(stTxt[0], stTxt[1])}</div>
        <div class="kv"><span>Berlaku hingga</span><span>${u.expired_at ? esc(RB.date(u.expired_at)) : '-'}</span></div><div class="kv"><span>Session</span><span>${u.hasSession ? 'Tersimpan' : 'Belum'}</span></div>
        <div class="kv"><span>Pesanan lunas</span><span>${u.paidOrders} (${rp(u.paidTotal)})</span></div><div class="kv"><span>Trial</span><span>${u.trial_used ? 'Sudah dipakai' : 'Belum'}</span></div>
        <div class="kv"><span>Token</span><span class="mono">${u.token ? esc(u.token.token) + ` (${u.token.uses}/${u.token.max_uses})` : '-'}</span></div>
        ${u.tokenLog.map((l) => `<div class="kv"><span>Pindah token</span><span class="mono">${l.from_id} ke ${l.to_id}</span></div>`).join('')}
        <div class="stack" style="margin-top:16px"><button class="btn block" data-a="extend">Tambah hari VIP</button>
        <button class="btn ghost block" data-a="token">Reset token</button><button class="btn danger block" data-a="revoke">Cabut VIP</button></div>`;
      const act = (a) => ({
        extend: () => formSheet('Tambah hari VIP', [{ name: 'days', label: 'Jumlah hari', mode: 'numeric', ph: '30' }], 'Tambahkan', async (v, f) => { const r = await RB.api(`admin/users/${id}/extend`, { body: { days: v.days } }); f.close(); RB.toast('VIP aktif hingga ' + RB.date(r.expired), 'ok'); s.close(); openUser(id); }),
        token: async () => { if (await RB.confirm('Reset token?', 'Kode lama hangus dan pemakaian kembali ke 0.', 'Reset')) { const r = await RB.api(`admin/users/${id}/token`, { body: {} }); RB.toast('Token baru: ' + r.token.token, 'ok'); s.close(); openUser(id); } },
        revoke: async () => { if (await RB.confirm('Cabut VIP?', 'Langganan user dinonaktifkan dan user diberi tahu.', 'Cabut', true)) { await RB.api(`admin/users/${id}/revoke`, { body: {} }); RB.toast('VIP dicabut', 'ok'); s.close(); openUser(id); } },
      })[a]();
      s.el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => Promise.resolve(act(b.dataset.a)).catch(RB.fail)));
    } catch (e) { s.close(); RB.fail(e); }
  }

  // ── Paket ──
  const planFields = (p = {}) => [{ name: 'name', label: 'Nama paket', value: p.name, ph: 'VIP 30 Hari' }, { name: 'days', label: 'Durasi (hari)', value: p.days, mode: 'numeric' }, { name: 'price', label: 'Harga (Rp)', value: p.price, mode: 'numeric' }];
  async function vPlans() {
    const { plans } = await RB.api('admin/plans');
    pane(`<button class="btn block" style="margin-bottom:14px" data-act="planadd">${ico('plus', 's')} Tambah paket</button>` + (plans.length ? plans.map((p) => `<button class="item" data-act="plan" data-p='${esc(JSON.stringify(p))}'><span class="grow"><div class="t">${esc(p.name)}</div><div class="s">${p.days} hari - ${rp(p.price)}</div></span>${badge(p.is_active ? 'Aktif' : 'Nonaktif', p.is_active ? 'ok' : '')}</button>`).join('') : '<div class="empty">Belum ada paket.</div>'));
  }

  // ── Promo & voucher ──
  async function vPromos() {
    const { promos } = await RB.api('admin/promos');
    pane(`<button class="btn block" style="margin-bottom:14px" data-act="promoadd">${ico('plus', 's')} Buat kode promo</button>` + (promos.length ? promos.map((p) => {
      const dead = p.expires_at && RB.parse(p.expires_at) < new Date();
      return `<button class="item" data-act="promo" data-p='${esc(JSON.stringify(p))}'><span class="tile">${ico('tag')}</span><span class="grow"><div class="t">${esc(p.code)} - ${p.percent}%</div><div class="s">Dipakai ${p.used}/${p.max_uses || 'tanpa batas'} - ${exp(p.expires_at)}</div></span>${badge(!p.is_active ? 'Nonaktif' : dead ? 'Kedaluwarsa' : 'Aktif', !p.is_active || dead ? '' : 'ok')}</button>`;
    }).join('') : '<div class="empty">Belum ada kode promo.</div>'));
  }
  async function vVouchers() {
    const { vouchers } = await RB.api('admin/vouchers');
    pane(`<div class="row" style="margin-bottom:14px"><button class="btn grow" data-act="vchadd">${ico('plus', 's')} Buat voucher</button><button class="btn ghost grow" data-act="vchbulk">Buat banyak</button></div>` + (vouchers.length ? vouchers.map((v) => {
      const dead = v.expires_at && RB.parse(v.expires_at) < new Date();
      return `<button class="item" data-act="vch" data-p='${esc(JSON.stringify(v))}'><span class="tile">${ico('ticket')}</span><span class="grow"><div class="t mono" style="font-size:14px">${esc(v.code)}</div><div class="s">${v.days} hari - diklaim ${v.claimed}/${v.max_claims || 'tanpa batas'} - ${exp(v.expires_at)}</div></span>${badge(!v.is_active ? 'Nonaktif' : dead ? 'Kedaluwarsa' : 'Aktif', !v.is_active || dead ? '' : 'ok')}</button>`;
    }).join('') : '<div class="empty">Belum ada voucher.</div>'));
  }
  // Sheet ringkas untuk mengaktifkan/menghapus promo, voucher, paket
  function manage(kind, item, title, lines) {
    const s = RB.sheet(`<h3 class="h1" style="font-size:20px;margin-bottom:12px">${esc(title)}</h3>${lines.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('')}
      <div class="stack" style="margin-top:16px">${kind === 'plans' ? '<button class="btn block" data-a="edit">Ubah paket</button>' : ''}
      <button class="btn ghost block" data-a="toggle">${item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="btn danger block" data-a="delete">Hapus</button></div>`);
    s.el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      try {
        const a = b.dataset.a, url = `admin/${kind}/${item.id}`;
        if (a === 'edit') return formSheet('Ubah paket', planFields(item), 'Simpan', async (v, f) => { await RB.api(url, { body: v }); f.close(); s.close(); RB.toast('Paket diperbarui', 'ok'); load(); });
        if (a === 'delete' && !(await RB.confirm('Hapus permanen?', 'Tindakan ini tidak bisa dibatalkan.', 'Hapus', true))) return;
        await RB.api(url, { body: a === 'delete' ? { delete: true } : { active: !item.is_active } });
        s.close(); RB.toast('Berhasil', 'ok'); load();
      } catch (e) { RB.fail(e); }
    }));
  }

  // ── Pengaturan pembayaran ──
  async function vSettings() {
    const s = await RB.api('admin/settings');
    pane(`<div class="card"><div class="row" style="margin-bottom:12px"><div class="tile">${ico('qr')}</div><div class="grow"><b>QRIS statis toko</b><div class="sm mut">${s.qris ? esc(s.qris.merchant_name) + ' - ' + esc(s.qris.merchant_city) : 'Belum diatur. Pembelian lewat bot dan web tidak aktif.'}</div></div></div>
        <button class="btn ghost block" data-act="setqris">${s.qris ? 'Ganti QRIS' : 'Atur QRIS'}</button></div>
      <div class="card"><div class="row"><div class="grow"><b>Kode unik nominal</b><div class="sm mut">Tambah 1 sampai 99 rupiah agar tiap pesanan mudah dicocokkan dengan mutasi.</div></div><div class="switch ${s.unique ? 'on' : ''}" data-act="setunique"></div></div></div>
      <div class="card"><b>Batas waktu pembayaran</b><div class="sm mut" style="margin:4px 0 12px">Dalam menit (5 sampai 1440).</div><div class="promo"><input class="input" id="expMin" value="${s.expire}" inputmode="numeric"><button class="btn soft" data-act="setexpire">Simpan</button></div></div>`);
  }

  // ── Siaran ──
  function vAnnounce() {
    pane(`<div class="card"><b>Kirim pengumuman</b><div class="sm mut" style="margin:4px 0 12px">Dikirim ke semua pengguna bot melalui chat bot. Teks biasa, tanpa format.</div>
      <textarea class="input" id="annText" placeholder="Tulis pesan..." maxlength="3500"></textarea><button class="btn block" style="margin-top:12px" data-act="annsend">${ico('send', 's')} Kirim ke semua</button><div id="annLog" class="sm mut" style="margin-top:12px"></div></div>`);
  }

  // ── Blacklist channel ──
  async function vBlacklist() {
    const { items } = await RB.api('admin/blacklist');
    pane(`<div class="note" style="margin-bottom:12px">${ico('alert', 's')}<div>Channel di daftar ini tidak bisa diunduh lewat perintah <b>.copy</b> oleh siapa pun.</div></div><button class="btn block" style="margin-bottom:14px" data-act="bladd">${ico('plus', 's')} Tambah channel</button>` +
      (items.length ? items.map((i) => `<div class="item" style="cursor:default"><span class="tile">${ico('block')}</span><span class="grow"><div class="t">${esc(i.identifier)}</div><div class="s">${esc(i.note || 'Tanpa catatan')}</div></span><button class="btn ghost sm" data-act="blrm" data-id="${esc(i.identifier)}">Hapus</button></div>`).join('') : '<div class="empty">Daftar kosong.</div>'));
  }

  const LOADERS = { overview: vOverview, orders: () => vOrders(0), users: () => vUsers(''), plans: vPlans, promos: vPromos, vouchers: vVouchers, settings: vSettings, announce: vAnnounce, blacklist: vBlacklist };
  async function load() { try { await LOADERS[C.tab](); } catch (e) { pane(`<div class="empty">${esc(e.message)}</div>`); } }
  const go = (tab) => { C.tab = tab; shell(loading); load(); };

  const ACT = {
    tab: (el) => go(el.dataset.tab), gotoorders: () => { C.filter = 'open'; go('orders'); },
    filter: (el) => { C.filter = el.dataset.f; shell(loading); load(); },
    ordersmore: (el) => RB.busy(el, () => vOrders(Number(el.dataset.page), true)),
    order: (el) => openOrder(el.dataset.id), user: (el) => openUser(el.dataset.id),
    usearch: () => vUsers(document.getElementById('uq').value.trim()).catch(RB.fail),
    planadd: () => formSheet('Tambah paket', planFields(), 'Simpan', async (v, s) => { await RB.api('admin/plans', { body: v }); await done(s, 'Paket ditambahkan'); }),
    plan: (el) => { const p = JSON.parse(el.dataset.p); manage('plans', p, p.name, [['Durasi', p.days + ' hari'], ['Harga', rp(p.price)], ['Status', p.is_active ? 'Aktif' : 'Nonaktif']]); },
    promoadd: () => formSheet('Buat kode promo', [{ name: 'code', label: 'Kode (atau tulis acak)', ph: 'HEMAT20' }, { name: 'percent', label: 'Diskon (1 sampai 100 persen)', mode: 'numeric', ph: '20' }, { name: 'quota', label: 'Kuota pemakaian (0 = tanpa batas)', mode: 'numeric', value: '0' }, { name: 'validDays', label: 'Berlaku berapa hari (0 = tanpa batas)', mode: 'numeric', value: '0' }], 'Buat promo',
      async (v, s) => { const r = await RB.api('admin/promos', { body: v }); await done(s, 'Kode promo dibuat: ' + r.code); }, 'Tiap user hanya bisa memakai satu kode sekali. Diskon 100 persen membuat pesanan gratis.'),
    promo: (el) => { const p = JSON.parse(el.dataset.p); manage('promos', p, p.code, [['Diskon', p.percent + '%'], ['Dipakai', `${p.used} / ${p.max_uses || 'tanpa batas'}`], ['Berlaku s/d', exp(p.expires_at)]]); },
    vchadd: () => formSheet('Buat voucher', [{ name: 'code', label: 'Kode (atau tulis acak)', ph: 'GRATIS7' }, { name: 'days', label: 'Hari VIP', mode: 'numeric', ph: '7' }, { name: 'quota', label: 'Kuota klaim (0 = tanpa batas)', mode: 'numeric', value: '1' }, { name: 'validDays', label: 'Berlaku berapa hari (0 = tanpa batas)', mode: 'numeric', value: '0' }], 'Buat voucher',
      async (v, s) => { const r = await RB.api('admin/vouchers', { body: v }); await done(s, 'Voucher dibuat: ' + r.code); }),
    vchbulk: () => formSheet('Buat voucher banyak', [{ name: 'days', label: 'Hari VIP per voucher', mode: 'numeric', ph: '30' }, { name: 'count', label: 'Jumlah (maks 50)', mode: 'numeric', ph: '10' }, { name: 'validDays', label: 'Berlaku berapa hari (0 = tanpa batas)', mode: 'numeric', value: '0' }], 'Buat voucher',
      async (v, s) => { const r = await RB.api('admin/vouchers/bulk', { body: v }); s.close(); load();
        const o = RB.sheet(`<h3 class="h1" style="font-size:20px">${r.codes.length} voucher dibuat</h3><p class="mut sm" style="margin-top:6px">Tiap kode sekali pakai.</p><pre class="codes">${esc(r.codes.join('\n'))}</pre><button class="btn block" style="margin-top:14px" data-copyall>Salin semua</button>`);
        o.el.querySelector('[data-copyall]').addEventListener('click', () => RB.copy(r.codes.join('\n'), 'Kode disalin')); }),
    vch: (el) => { const v = JSON.parse(el.dataset.p); manage('vouchers', v, v.code, [['Hadiah', v.days + ' hari VIP'], ['Diklaim', `${v.claimed} / ${v.max_claims || 'tanpa batas'}`], ['Berlaku s/d', exp(v.expires_at)]]); },
    setqris: () => formSheet('QRIS statis toko', [{ name: 'qris', label: 'Isi QRIS (diawali 000201)', area: true, ph: '000201010211...' }], 'Simpan', async (v, s) => { await RB.api('admin/settings', { body: { qris: v.qris } }); await done(s, 'QRIS tersimpan'); }),
    setunique: async (el) => { const on = !el.classList.contains('on'); try { await RB.api('admin/settings', { body: { unique: on } }); el.classList.toggle('on', on); RB.toast(on ? 'Kode unik aktif' : 'Kode unik nonaktif', 'ok'); } catch (e) { RB.fail(e); } },
    setexpire: (el) => RB.busy(el, async () => { try { await RB.api('admin/settings', { body: { expire: document.getElementById('expMin').value } }); RB.toast('Tersimpan', 'ok'); } catch (e) { RB.fail(e); } }),
    annsend: async (el) => {
      const text = document.getElementById('annText').value.trim(); if (!text) return RB.toast('Isi pesan dulu', 'bad');
      if (!(await RB.confirm('Kirim ke semua pengguna?', 'Pesan tidak bisa ditarik kembali.', 'Kirim'))) return;
      const log = document.getElementById('annLog');
      await RB.busy(el, async () => {
        let offset = 0, sent = 0, failed = 0;
        try { do { const r = await RB.api('admin/announce', { body: { text, offset } }); sent += r.sent; failed += r.failed; offset = r.next; log.textContent = `Terkirim ${sent}, gagal ${failed} dari ${r.total}...`; } while (offset !== null);
          log.textContent = `Selesai. Terkirim ${sent}, gagal ${failed}.`; RB.toast('Pengumuman terkirim', 'ok'); } catch (e) { RB.fail(e); log.textContent = `Berhenti. Terkirim ${sent}, gagal ${failed}.`; }
      });
    },
    bladd: () => formSheet('Tambah channel', [{ name: 'identifier', label: 'Username atau ID channel', ph: 'namachannel' }, { name: 'note', label: 'Catatan (opsional)' }], 'Tambah', async (v, s) => { await RB.api('admin/blacklist', { body: v }); await done(s, 'Ditambahkan'); }),
    blrm: async (el) => { try { await RB.api('admin/blacklist/remove', { body: { identifier: el.dataset.id } }); load(); } catch (e) { RB.fail(e); } },
  };
  RB.bind(root, ACT);

  // ── Boot: non-admin melihat halaman 404 biasa ──
  const notFound = () => { document.title = '404'; document.body.innerHTML = '<div style="font:14px monospace;color:#888;padding:24px">404 Not Found</div>'; };
  (async function () {
    if (!tg || !tg.initData) return notFound();
    RB.theme();
    try { await RB.login(); if (!RB.isAdmin) return notFound(); } catch (_) { return notFound(); }
    shell(loading); load();
  })();
})();
