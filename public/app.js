(function () {
  'use strict';
  const { esc, rp, ico, tg } = RB;
  const root = document.getElementById('app');
  const S = { tab: 'home', me: null, shop: null, promo: null, plan: null, open: {}, fresh: false, cfg: { bot: '', brand: 'RamsBot', contact: '' } };

  // Panduan per fitur. Semua perintah diketik dari akun Telegram kamu sendiri (bukan dikirim ke bot).
  // sec: [judul, 'steps'|'cmds'|'text'|'hint'|'warn', isi]
  const MODULES = [
    { id: 'dl', icon: 'download', title: 'Media Timer dan View Once', sum: 'Simpan foto atau video sekali lihat',
      sec: [
        ['Cara manual', 'steps', ['Buka chat yang berisi foto atau video <b>view once / timer</b>.', '<b>Balas (reply)</b> pesan itu dengan perintah di bawah.', 'Media tersimpan di <b>Saved Messages</b> (Pesan Tersimpan) akunmu.']],
        ['Perintah', 'cmds', [['.dl', 'Ketik sambil membalas pesan media']]],
        ['Cara otomatis', 'text', 'Aktifkan Auto Download agar setiap media view once yang masuk langsung tersimpan tanpa kamu mengetik apa pun.'],
        ['@autodl'],
        ['Catatan', 'hint', 'Auto Download hanya bekerja di chat pribadi. Perintah yang kamu ketik akan terhapus otomatis, itu normal.'],
      ] },
    { id: 'copy', icon: 'copy', title: 'Channel dan Grup Private', sum: 'Unduh pesan dari channel yang dibatasi',
      sec: [
        ['Cara pakai', 'steps', ['Pastikan akunmu <b>sudah bergabung</b> ke channel atau grup tersebut.', 'Buka postingan, lalu <b>salin link</b> postingannya.', 'Ketik perintah di bawah di chat mana saja, tempel link-nya, lalu kirim.', 'Hasilnya masuk ke <b>Saved Messages</b>.']],
        ['Perintah', 'cmds', [['.copy (link postingan)', 'Contoh: .copy https://t.me/koleksijee/456']]],
        ['Catatan', 'hint', 'Link harus diawali https://t.me/. Jika gagal, biasanya akunmu belum bergabung ke channel itu atau channel tersebut masuk daftar yang dibatasi admin.'],
      ] },
    { id: 'story', icon: 'play', title: 'Story', sum: 'Unduh story Telegram dari link',
      sec: [
        ['Cara pakai', 'steps', ['Buka story yang ingin disimpan, lalu <b>salin link story</b>.', 'Ketik perintah di bawah di chat mana saja dan tempel link-nya.', 'Story terunduh ke <b>Saved Messages</b>.']],
        ['Perintah', 'cmds', [['.story (link story)', 'Contoh: .story https://t.me/username/s/7']]],
        ['Catatan', 'hint', 'Story yang sudah dihapus, kedaluwarsa, atau diprivasi ketat tidak bisa diambil. Beberapa story hanya terbuka untuk kontak.'],
      ] },
    { id: 'bc', icon: 'send', title: 'Broadcast dan Blacklist', sum: 'Kirim pesan ke semua grup sekaligus',
      sec: [
        ['Cara pakai', 'steps', ['Ketik perintah broadcast beserta pesanmu di chat mana saja.', 'Bot mengirim pesan itu ke <b>semua grup</b> yang kamu ikuti, kecuali yang ada di blacklist.', 'Progres tampil di Saved Messages. Batalkan kapan saja dengan <b>.cancel</b> diikuti ID tugas.']],
        ['Perintah broadcast', 'cmds', [['.bc (pesan)', 'Contoh: .bc Halo semuanya'], ['.cancel #task_id', 'Hentikan broadcast yang berjalan']]],
        ['Blacklist: lewati grup tertentu', 'text', 'Grup di blacklist tidak akan menerima broadcast. Tambahkan atau hapus dengan perintah di bawah. Daftarnya juga bisa kamu lihat dan hapus langsung di sini.'],
        ['Perintah blacklist', 'cmds', [['.addbl', 'Ketik di dalam grup yang ingin dilewati'], ['.addbl (ID grup)', 'Atau dari chat mana saja pakai ID, contoh: .addbl -1001234567890'], ['.delbl', 'Keluarkan grup dari blacklist (ketik di dalam grup)'], ['.listbl', 'Kirim daftar blacklist ke Saved Messages']]],
        ['@blacklist'],
        ['Catatan', 'warn', 'Gunakan secukupnya. Broadcast berlebihan ke banyak grup bisa membuat akun dibatasi Telegram.'],
      ] },
    { id: 'qris', icon: 'qr', title: 'QRIS Dinamis', sum: 'Ubah QRIS statis jadi QR bernominal',
      sec: [
        ['Siapkan sekali', 'steps', ['Simpan <b>QRIS statis</b> milikmu di kartu di bawah (tempel kodenya, atau pindai dari gambar bila tersedia).', 'Pastikan status berubah menjadi <b>tersimpan</b>.']],
        ['@qris'],
        ['Pakai di Telegram', 'steps', ['Di chat mana saja, ketik perintah di bawah dengan nominalnya.', 'QR bernominal terkirim di chat itu juga.']],
        ['Perintah', 'cmds', [['.qris (nominal)', 'Contoh: .qris 25000'], ['.qris 25k', 'Singkatan juga bisa: 25k, 25rb, 1,5jt']]],
        ['Catatan', 'hint', 'QRIS statis harus valid (diawali 000201). Hasil dipakai langsung oleh pembayar tanpa perlu mengetik nominal.'],
      ] },
    { id: 'rich', icon: 'list', title: 'Rich Post', sum: 'Posting ke channel atau grup dengan format Rich Messages',
      sec: [
        ['Cara pakai', 'steps', ['Jadikan <b>@BOTNAME</b> admin di channel atau grup tujuan. Di channel, aktifkan izin <b>Post Messages</b>.', 'Di bot: <b>Fitur VIP</b>, lalu <b>Rich Post</b>, kemudian <b>Tujuan Saya</b> dan <b>Tambah Tujuan</b> (kirim @username, ID, atau forward satu pesan dari channel).', 'Tekan <b>Buat Postingan</b>, lalu kirim teks, atau foto/video dengan caption.', 'Pilih opsi format, cek <b>Pratinjau</b>, pilih tujuan, lalu <b>Posting</b>.']],
        ['Opsi format', 'text', 'Gaya (normal, kutipan, kutipan lipat, teks lipat, panel), judul dengan ukuran H1 sampai H6, spoiler, garis pemisah, footer, tombol link, notifikasi senyap, dan lindungi konten dari forward. Di isi utama, tulis ==teks== untuk menyorot.'],
        ['Blok tambahan', 'steps', ['Di panel Rich Post tekan <b>Blok</b>, lalu pilih jenis blok.', 'Ikuti petunjuk bot. Misalnya <b>Tabel</b>: kirim baris dengan kolom dipisah tanda |, baris pertama jadi header.', 'Geser urutan dengan tombol panah atau hapus dengan tong sampah. Maksimal 20 blok.']],
        ['Jenis blok', 'text', 'Heading, daftar (poin, nomor, centang), tabel, kode, kutipan, kutipan tengah, teks lipat, rumus, peta, galeri (kolase atau slideshow), pemisah, dan penempatan tombol.'],
        ['Tombol dalam teks', 'steps', ['Simpan tombol di opsi <b>Tombol link</b>. Format: Teks | link | warna (biru, hijau, merah, polos).', 'Ubah <b>Posisi</b> menjadi <b>Dalam teks</b>. Tombol otomatis di akhir isi.', 'Untuk menaruhnya di tengah teks, tulis penanda di isi postingan, di baris sendiri.']],
        ['Penanda posisi', 'cmds', [['{tombol}', 'Semua tombol di titik itu'], ['{tombol:2}', 'Hanya tombol nomor 2']]],
        ['Catatan', 'hint', 'Tidak perlu setup session. Kamu dan bot sama-sama harus admin di tujuan. Jika Rich Messages ditolak Telegram, postingan tidak terkirim otomatis dan kamu bisa memilih kirim sebagai pesan biasa.'],
      ] },
    { id: 'accept', icon: 'users', title: 'Auto Approve', sub: '', sum: 'Setujui semua permintaan join sekaligus',
      sec: [
        ['Cara pakai', 'steps', ['Pastikan kamu <b>admin</b> channel atau grup yang memakai persetujuan join.', 'Ketik perintah di dalam channel itu, atau tambahkan username atau link-nya.', 'Semua permintaan yang menunggu disetujui satu per satu sampai selesai.']],
        ['Perintah', 'cmds', [['.acceptall', 'Ketik di dalam channel'], ['.acceptall (username/link)', 'Contoh: .acceptall @namaChannel'], ['.stopaccept', 'Hentikan proses yang berjalan']]],
        ['Catatan', 'hint', 'Hanya berlaku untuk channel. Proses yang sama tidak bisa dijalankan dua kali bersamaan, hentikan dulu dengan .stopaccept.'],
      ] },
    { id: 'block', icon: 'shield', title: 'Auto Block Leaver', sum: 'Blokir otomatis yang keluar dari channel',
      sec: [
        ['Cara kerja', 'text', 'Jika seseorang keluar dari channel yang kamu pantau, akunnya otomatis diblokir dari akun Telegram kamu.'],
        ['Cara mengaktifkan', 'steps', ['Pastikan <b>session sudah aktif</b> dan kamu admin di channel yang ingin dipantau.', 'Tambahkan <b>@BOTNAME</b> sebagai admin di channel itu agar keluar-masuk anggota terdeteksi.', 'Di bot: <b>Fitur VIP</b>, lalu <b>Auto Block Leaver</b>, kemudian ketuk channel untuk mengaktifkan (tanda centang).']],
        ['@autoblock'],
        ['Catatan', 'hint', 'Daftar di atas adalah channel yang sedang dipantau. Menambah channel baru dilakukan di bot, karena daftar channel diambil langsung dari akun Telegram kamu.'],
      ] },
    { id: 'ping', icon: 'bolt', title: 'Ping', sum: 'Cek apakah session masih hidup',
      sec: [
        ['Cara pakai', 'steps', ['Buka <b>Saved Messages</b> di Telegram.', 'Kirim perintah di bawah.', 'Balasan seperti <b>Pong! 42ms</b> berarti session aktif.']],
        ['Perintah', 'cmds', [['.ping', 'Ketik di Saved Messages']]],
        ['Tidak ada balasan?', 'hint', 'Cek VIP masih aktif, lalu atur ulang session lewat tombol di Beranda.'],
      ] },
  ];

  const SETUP_STEPS = [
    'Tekan <b>Buka bot</b> di bawah, lalu tekan tombol <b>Setup Bot</b> di chat.',
    'Baca ketentuan, lalu tekan <b>Saya Setuju</b>.',
    'Kirim <b>nomor HP</b> akun yang mau dipakai, contoh <span class="mono gold">+6281234567890</span>.',
    'Telegram mengirim <b>kode OTP</b> ke akun itu. Kirim ke bot dengan spasi antar angka, contoh <span class="mono gold">1 2 3 4 5</span>.',
    'Jika akunmu memakai verifikasi dua langkah, kirim <b>password 2FA</b>.',
    'Setelah bot mengonfirmasi, kembali ke Mini App. Fitur siap dipakai.',
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
  function shell(body, keepFresh) {
    const name = (RB.user && RB.user.name) || 'U', fresh = S.fresh;
    if (!keepFresh) S.fresh = false;
    root.innerHTML = `<div class="wrap"><div class="top"><span class="brand">${esc(S.cfg.brand)}</span><span class="avatar">${esc(name.trim().charAt(0).toUpperCase())}</span></div><div class="${fresh ? 'view stg' : ''}">${body}</div></div>
      <nav class="nav"><div>${NAV.map(([k, i, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${ico(i)}<span>${l}</span></button>`).join('')}</div></nav>`;
  }
  async function render() {
    if (S.tab === 'home') return shell(viewHome());
    if (S.tab === 'shop') {
      shell(loading(), true);
      try { S.shop = await RB.api('shop'); } catch (e) { RB.fail(e); }
      if (S.shop && !S.shop.plans.some((p) => p.id === S.plan)) S.plan = S.shop.plans.length ? S.shop.plans[0].id : null;
      return S.tab === 'shop' && shell(viewShop());
    }
    if (S.tab === 'features') return shell(viewFeatures());
    if (S.tab === 'account') return shell(viewAccount());
  }
  async function refresh(keepView) {
    S.me = await RB.api('me');
    if (!keepView) await render(); else if (S.tab !== 'shop') await render();
  }

  // ── Beranda: ringkas ──
  function viewHome() {
    const m = S.me, sub = m.sub, [title, cls] = STATUS[sub.state](sub), act = isActive();
    const pct = act ? Math.min(100, Math.round((sub.remaining_ms / (30 * 86400000)) * 100)) : 0;
    const expiring = act && sub.plan === 'vip' && sub.remaining_ms < 3 * 86400000;
    const ready = act && m.hasSession;
    const num = (n, done) => `<span class="num">${done ? ico('check') : n}</span>`;
    const st1 = act ? 'done' : 'now', st2 = m.hasSession ? 'done' : act ? 'now' : '', st3 = ready ? 'now' : '';
    return `
      <div class="hello"><div><span class="mut">Selamat datang,</span><b>${esc((RB.user && RB.user.name) || 'Pengguna')}</b></div></div>
      <div class="card hero tight">
        <div class="hero-top"><span class="label">Keanggotaan</span>${badge(title, cls)}</div>
        <div class="hero-main"><div><div class="big">${act ? esc(remainText(sub).replace(' tersisa', '')) : esc(title)}</div>
          <div class="mut sm" style="margin-top:2px">${act ? 'tersisa - hingga ' + esc(RB.date(sub.expired_at, false)) : sub.expired_at ? 'Berakhir ' + esc(RB.date(sub.expired_at, false)) : 'Aktifkan VIP untuk memakai fitur'}</div></div></div>
        ${act ? `<div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>` : ''}
        <div class="hero-actions"><button class="btn" data-act="tab" data-tab="shop">${act ? 'Perpanjang VIP' : 'Beli VIP'}</button>${!act && !m.trialUsed ? '<button class="btn ghost" data-act="trial">Coba trial</button>' : ''}</div>
      </div>
      ${expiring ? note('VIP hampir berakhir. Perpanjang sekarang, sisa hari otomatis ditambahkan.') : ''}
      ${ready ? `<div class="card flat"><div class="row"><div class="tile" style="color:var(--ok);background:rgba(98,209,160,.1);border-color:rgba(98,209,160,.3)">${ico('check')}</div><div class="grow"><div style="font-weight:600">Semua siap dipakai</div><div class="sm mut">Ketik perintah dari chat Telegram mana saja.</div></div><button class="btn sm" data-act="tab" data-tab="features">Panduan</button></div>
          <div class="row between xs dim" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><span class="row gap8"><i class="dotok"></i>Session terhubung</span><button class="btn ghost sm" data-act="setup">Atur ulang</button></div></div>`
      : `<div class="card"><div class="card-h"><span class="label">Mulai di sini</span><span class="xs dim">${[act, m.hasSession].filter(Boolean).length} dari 3 selesai</span></div><div class="steps">
          <div class="step ${st1}">${num(1, act)}<div class="grow"><div class="tt">Aktifkan VIP</div><div class="dd">${act ? 'VIP kamu sudah aktif.' : 'Beli paket, klaim voucher, atau coba trial gratis.'}</div></div></div>
          <div class="step ${st2}">${num(2, m.hasSession)}<div class="grow"><div class="tt">Setup session Telegram</div><div class="dd">${m.hasSession ? 'Akunmu sudah terhubung ke bot.' : act ? 'Hubungkan akun Telegram lewat bot agar fitur berjalan. Hanya sekali, sekitar 1 menit.' : 'Tersedia setelah VIP aktif.'}</div>
            ${act && !m.hasSession ? `<button class="btn sm" data-act="setup">${ico('bolt', 's')} Setup sekarang</button>` : ''}</div></div>
          <div class="step ${st3}">${num(3, false)}<div class="grow"><div class="tt">Pakai fitur</div><div class="dd">Ketik perintah seperti .dl atau .copy di chat Telegram mana saja.</div>
            <button class="btn ghost sm" data-act="tab" data-tab="features">Lihat panduan fitur</button></div></div>
        </div></div>`}
      <div class="mini">
        <button data-act="voucher"><span class="tile">${ico('ticket')}</span>Voucher</button>
        <button data-act="tokenpage"><span class="tile">${ico('key')}</span>Token VIP</button>
        <button data-act="orders"><span class="tile">${ico('list')}</span>Riwayat</button>
        <button data-act="tab" data-tab="features"><span class="tile">${ico('sliders')}</span>Fitur</button>
      </div>`;
  }

  // ── Beli VIP ──
  const planPrice = (p) => (S.promo ? RB.discount(p.price, S.promo.percent)[1] : p.price);
  const planPer = (p) => p.price / Math.max(1, p.days);
  function payBar() {
    const sh = S.shop, p = sh.plans.find((x) => x.id === S.plan);
    if (!p) return '';
    const f = planPrice(p);
    return `<div class="row"><div class="grow tot"><small>${esc(p.name)} - ${p.days} hari</small>${f > 0 ? rp(f) : '<span class="gold">Gratis</span>'}</div><button class="btn" data-act="buy" data-id="${p.id}">${f > 0 ? 'Lanjut bayar' : 'Klaim gratis'}${ico('chev', 's')}</button></div>`;
  }
  function viewShop() {
    const sh = S.shop;
    if (!sh) return '<div class="empty">Gagal memuat paket.</div>';
    const promo = S.promo;
    const promoCard = promo
      ? `<div class="card flat row"><div class="tile">${ico('tag')}</div><div class="grow"><div style="font-weight:600">${esc(promo.code)}</div><div class="sm ok">Diskon ${promo.percent}% terpasang</div></div><button class="btn ghost sm" data-act="promoclear">Hapus</button></div>`
      : `<div class="card flat" style="padding:12px 14px"><div class="promo"><input class="input" id="promoIn" placeholder="Punya kode promo?" autocomplete="off" autocapitalize="characters"><button class="btn soft" data-act="promoapply">Terapkan</button></div></div>`;
    const best = sh.plans.length > 1 ? sh.plans.filter((p) => p.days >= 7).reduce((a, p) => (!a || planPer(p) < planPer(a) ? p : a), null) : null;
    const plans = sh.plans.map((p) => {
      const final = planPrice(p), on = p.id === S.plan;
      return `<button class="plan ${on ? 'on' : ''}" data-act="pick" data-id="${p.id}" role="radio" aria-checked="${on}">${best && best.id === p.id ? '<span class="tagbest">Paling hemat</span>' : ''}<span class="radio"></span>
        <span class="info"><div class="n">${esc(p.name)}</div><div class="d">${p.days} hari${p.days >= 7 ? ' - ' + rp(Math.round(final / p.days)) + ' per hari' : ''}</div></span>
        <span class="p">${promo ? `<s style="color:var(--dim);font-size:12px;display:block;font-weight:400">${rp(p.price)}</s>` : ''}${final > 0 ? rp(final) : '<span class="gold">Gratis</span>'}</span></button>`;
    }).join('');
    return `<h1 class="h1">Beli VIP</h1><p class="tip" style="margin-top:6px">Perpanjang sebelum habis, sisa hari otomatis ditambahkan.</p>
      <div class="how"><div><b>1</b>Pilih paket</div><div><b>2</b>Bayar lewat QRIS</div><div><b>3</b>Kirim bukti bayar</div></div>
      ${sh.openOrder ? `<button class="item" data-act="vieworder" data-id="${sh.openOrder.id}"><span class="tile">${ico('clock')}</span><span class="grow"><div class="t">Pesanan #${sh.openOrder.id} belum selesai</div><div class="s">${esc(ORDER_STATUS[sh.openOrder.status][0])} - ${rp(sh.openOrder.total)}</div></span>${ico('chev', 's')}</button>` : ''}
      ${sh.ready ? `<div class="h2" style="margin-top:6px">Pilih paket</div><div role="radiogroup" id="plans">${plans}</div>${promoCard}
        <div class="paybar" id="paybar">${payBar()}</div>
        <div style="margin-top:14px">${note(`Bayar dengan QRIS (semua e-wallet dan m-banking), lalu unggah bukti bayar. Pesanan berlaku ${sh.expireMinutes} menit. Token VIP dikirim bot setelah pembayaran dikonfirmasi.`)}</div>` : '<div class="empty">Pembayaran belum tersedia. Hubungi admin.</div>'}`;
  }

  // ── Fitur: modul per fitur ──
  const cmdLine = (code, desc) => `<div class="cmd" data-act="copycmd" data-v="${esc(code.replace(/\s*\(.*\)$/, ' '))}"><div style="flex:1;min-width:0"><code>${esc(code)}</code>${desc ? `<small>${esc(desc)}</small>` : ''}</div><span class="cp">${ico('copy', 's')}</span></div>`;
  function modControl(key) {
    const m = S.me;
    if (key === '@autodl') return `<div class="ctl"><div class="row"><div class="grow"><div style="font-weight:600;font-size:14px">Auto Download</div><div class="xs mut">${m.autoDl ? 'Aktif: media view once tersimpan otomatis' : 'Nonaktif: kamu harus mengetik .dl manual'}</div></div><div class="switch ${m.autoDl ? 'on' : ''}" data-act="autodl" role="switch" aria-checked="${!!m.autoDl}"></div></div></div>`;
    if (key === '@qris') return `<div class="ctl"><div class="row" style="margin-bottom:${m.qris ? 12 : 10}px"><span class="${m.qris ? 'dotok' : 'dotno'}"></span><div class="grow"><div style="font-weight:600;font-size:14px">${m.qris ? esc(m.qris.merchant || 'QRIS tersimpan') : 'QRIS statis belum disimpan'}</div><div class="xs mut">${m.qris ? esc(m.qris.city || 'Siap dipakai dengan .qris') : 'Simpan dulu agar .qris bisa dipakai'}</div></div></div>
      ${m.qris ? `<div class="promo"><input class="input" id="qrisAmt" inputmode="numeric" placeholder="Coba nominal, contoh 25000"><button class="btn" data-act="qrisgen">Buat QR</button></div><div class="row" style="margin-top:10px"><button class="btn ghost sm grow" data-act="qrisedit">Ganti QRIS</button><button class="btn danger sm grow" data-act="qrisdel">Hapus</button></div>` : `<button class="btn block" data-act="qrisedit">Simpan QRIS statis</button>`}</div>`;
    if (key === '@blacklist') return `<div class="sub">Grup di blacklist <span class="cnt">${m.bcBlacklist.length}</span></div><div class="lst">${m.bcBlacklist.length ? m.bcBlacklist.map((g) => `<div class="item"><span class="tile" style="width:34px;height:34px">${ico('block', 's')}</span><span class="grow"><div class="t" style="font-size:14px">${esc(g.group_name || g.group_id)}</div><div class="s mono">${esc(g.group_id)}</div></span><button class="btn ghost sm" data-act="bcrm" data-id="${esc(g.group_id)}">Hapus</button></div>`).join('') : '<div class="empty" style="padding:12px 4px;text-align:left">Belum ada. Semua grup menerima broadcast.</div>'}</div>`;
    if (key === '@autoblock') return `<div class="sub">Channel dipantau <span class="cnt">${m.autoBlock.length}</span></div><div class="lst">${m.autoBlock.length ? m.autoBlock.map((c) => `<div class="item"><span class="tile" style="width:34px;height:34px">${ico('shield', 's')}</span><span class="grow"><div class="t" style="font-size:14px">${esc(c.channel_name || c.channel_id)}</div><div class="s">Aktif dipantau</div></span><button class="btn ghost sm" data-act="abrm" data-id="${esc(c.channel_id)}">Hentikan</button></div>`).join('') : '<div class="empty" style="padding:12px 4px;text-align:left">Belum ada channel yang dipantau.</div>'}</div><button class="btn soft block" style="margin-top:10px" data-act="openfitur">${ico('bolt', 's')} Tambah channel lewat bot</button>`;
    return '';
  }
  function modBody(md) {
    return md.sec.map((x) => {
      if (x[0].startsWith('@')) return modControl(x[0]);
      const [h, kind, c] = x;
      const head = `<div class="sub">${esc(h)}</div>`;
      if (kind === 'steps') return head + `<ol class="ol">${c.map((t) => `<li>${t.replace(/@BOTNAME/g, '@' + esc(S.cfg.bot || 'bot'))}</li>`).join('')}</ol>`;
      if (kind === 'cmds') return head + c.map(([a, b]) => cmdLine(a, b)).join('');
      if (kind === 'text') return head + `<p class="sm mut" style="margin:0;line-height:1.5">${esc(c)}</p>`;
      return `<div class="hint ${kind === 'warn' ? 'warn' : ''}">${ico(kind === 'warn' ? 'alert' : 'link', 's')}<div>${esc(c)}</div></div>`;
    }).join('');
  }
  function modChip(id) {
    const m = S.me;
    if (id === 'dl') return badge(m.autoDl ? 'Auto ON' : 'Auto OFF', m.autoDl ? 'ok' : '');
    if (id === 'qris') return badge(m.qris ? 'Tersimpan' : 'Belum', m.qris ? 'ok' : 'warn');
    if (id === 'bc' && m.bcBlacklist.length) return `<span class="cnt">${m.bcBlacklist.length}</span>`;
    if (id === 'block' && m.autoBlock.length) return `<span class="cnt">${m.autoBlock.length}</span>`;
    return '';
  }
  function viewFeatures() {
    const m = S.me, act = isActive();
    const gate = !act
      ? `<div class="gate">${ico('lock')}<div class="grow"><div class="t">Fitur terkunci</div><div class="s">Aktifkan VIP dulu. Panduan di bawah tetap bisa dibaca.</div></div><button class="btn sm" data-act="tab" data-tab="shop">Beli VIP</button></div>`
      : !m.hasSession
        ? `<div class="gate">${ico('alert')}<div class="grow"><div class="t">Session belum disetel</div><div class="s">Perintah berawalan titik (.dl, .copy, dst) baru jalan setelah akunmu terhubung. Rich Post tidak memerlukan session.</div></div><button class="btn sm" data-act="setup">Setup</button></div>` : '';
    return `<h1 class="h1">Fitur VIP</h1><p class="tip" style="margin-top:6px">Ketuk fitur untuk melihat cara pakai. Semua perintah diketik dari akun Telegram kamu sendiri di chat mana saja, bukan dikirim ke bot.</p>
      ${gate}
      ${MODULES.map((md) => `<div class="mod ${S.open[md.id] ? 'open' : ''}" data-mod="${md.id}"><button class="mod-h" data-act="modtoggle" data-id="${md.id}"><span class="tile">${ico(md.icon)}</span><span class="grow"><div class="t">${esc(md.title)}</div><div class="s">${esc(md.sum)}</div></span>${modChip(md.id)}${ico('chev', 's chev')}</button>
        <div class="mod-b"><div><div class="mod-in">${modBody(md)}</div></div></div></div>`).join('')}`;
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

  // ── Sheet: panduan setup session ──
  function setupSheet() {
    const act = isActive();
    const s = RB.sheet(`<h3 class="h1" style="font-size:21px">Setup session</h3>
      <p class="mut sm" style="margin:8px 0 14px">Session menghubungkan akun Telegram kamu ke ${esc(S.cfg.brand)} agar perintah seperti .dl dan .copy bisa berjalan. Cukup dilakukan <b style="color:var(--tx)">sekali</b>, sekitar 1 menit.</p>
      ${act ? '' : note('VIP belum aktif. Aktifkan VIP atau trial dulu, baru setup bisa dilanjutkan.', 'bad')}
      <ol class="ol" style="margin-top:${act ? 0 : 14}px">${SETUP_STEPS.map((t) => `<li>${t}</li>`).join('')}</ol>
      <div class="hint">${ico('lock', 's')}<div>Bot tidak menyimpan password atau kode OTP. Kamu bisa mencabut akses kapan saja di Pengaturan Telegram, menu Perangkat.</div></div>
      <button class="btn block" style="margin-top:16px" data-go>${act ? ico('send', 's') + ' Buka bot dan mulai setup' : 'Beli VIP dulu'}</button>`);
    s.el.querySelector('[data-go]').addEventListener('click', () => { s.close(); if (act) openBot('setup'); else { S.tab = 'shop'; S.fresh = true; render(); window.scrollTo(0, 0); } });
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
      ${S.me && S.me.hasSession ? '' : `<div style="margin-top:14px">${note('Langkah berikutnya: <b>setup session</b> agar fitur VIP bisa dipakai.')}</div>`}
      <button class="btn block" style="margin-top:14px" data-done>${S.me && S.me.hasSession ? 'Selesai' : 'Lanjut setup session'}</button>${S.me && S.me.hasSession ? '' : '<button class="btn ghost block" style="margin-top:8px" data-later>Nanti saja</button>'}`);
    s.el.querySelector('[data-done]').addEventListener('click', () => { s.close(); if (!(S.me && S.me.hasSession)) setupSheet(); });
    const later = s.el.querySelector('[data-later]'); if (later) later.addEventListener('click', () => s.close());
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
      <div style="margin:14px 0">${note('Bayar <b>tepat sesuai total</b> (termasuk kode unik), lalu kirim bukti bayar.')}</div>
      <button class="btn block" data-botpay>${ico('bolt', 's')} Verifikasi otomatis lewat bot</button>
      <p class="xs dim" style="margin:8px 4px 14px;text-align:center">Kirim bukti di chat bot. Bot memeriksa nominalnya, dan jika cocok VIP aktif otomatis. Jika tidak, diteruskan ke admin.</p>
      <label class="btn ghost block" style="cursor:pointer">${ico('upload', 's')} Unggah bukti ke admin (manual)<input type="file" accept="image/*" hidden data-proof></label>
      <button class="btn danger block" style="margin-top:10px" data-cancel>Batalkan pesanan</button>`;
    if (o.status === 'verifying') return `${head}<div style="text-align:center;padding:10px 0 18px"><div class="spin" style="margin:0 auto 14px"></div><div style="font-weight:600">Menunggu verifikasi admin</div><div class="sm mut" style="margin-top:4px">Halaman ini diperbarui otomatis. Kamu juga akan menerima pesan dari bot.</div></div>${kvs}<div class="kv"><span>Total</span><span><b>${rp(o.total)}</b></span></div>
      <button class="btn ghost block" style="margin-top:14px" data-botpay>Kirim ulang bukti lewat bot</button>
      <label class="btn ghost block" style="margin-top:10px;cursor:pointer">Kirim ulang bukti ke admin<input type="file" accept="image/*" hidden data-proof></label>`;
    if (o.status === 'paid') return `${head}<div style="text-align:center;margin:6px 0 16px"><div class="tile" style="margin:0 auto 12px;width:54px;height:54px;border-radius:16px;color:var(--ok);background:rgba(98,209,160,.1);border-color:rgba(98,209,160,.3)">${ico('check')}</div>
      <div style="font-weight:650;font-size:18px">Pembayaran berhasil</div><div class="sm mut" style="margin-top:4px">VIP kamu sudah aktif.</div></div>${kvs}<div class="kv"><span>Total</span><span><b>${rp(o.total)}</b></span></div>
      ${o.token ? `<div style="margin-top:16px">${tokenBlock(o.token)}</div>` : ''}${S.me && S.me.hasSession ? '' : `<button class="btn block" style="margin-top:14px" data-setup>${ico('bolt', 's')} Lanjut setup session</button>`}<button class="btn ${S.me && S.me.hasSession ? '' : 'ghost'} block" style="margin-top:10px" data-close>Selesai</button>`;
    return `${head}${kvs}<div class="kv"><span>Total</span><span>${rp(o.total)}</span></div><button class="btn block" style="margin-top:16px" data-close data-shop>Kembali ke paket</button>`;
  }
  function wireOrder(s, o) {
    s.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { s.close(); if (b.hasAttribute('data-shop')) { S.tab = 'shop'; render(); } }));
    s.el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => RB.copy(b.dataset.copy, 'Nominal disalin')));
    s.el.querySelectorAll('[data-act="copytoken"]').forEach((b) => b.addEventListener('click', () => RB.copy(b.dataset.v, 'Token disalin')));
    s.el.querySelectorAll('[data-botpay]').forEach((b) => b.addEventListener('click', () => openBot('pay_' + o.id)));
    s.el.querySelectorAll('[data-setup]').forEach((b) => b.addEventListener('click', () => { s.close(); setupSheet(); }));
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
    tab: (el) => { if (S.tab === el.dataset.tab) return; S.tab = el.dataset.tab; S.fresh = true; render(); window.scrollTo(0, 0); },
    setup: setupSheet,
    openfitur: () => { RB.toast('Di bot: Fitur VIP, lalu Auto Block Leaver'); openBot(''); },
    pick: (el) => {
      const id = Number(el.dataset.id); if (id === S.plan) return;
      S.plan = id; RB.haptic('select');
      root.querySelectorAll('.plan').forEach((b) => { const on = Number(b.dataset.id) === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      const pb = document.getElementById('paybar'); if (pb) pb.innerHTML = payBar();
    },
    modtoggle: (el) => {
      const id = el.dataset.id, box = el.closest('.mod'), open = !box.classList.contains('open');
      box.classList.toggle('open', open); S.open[id] = open;
      if (open) setTimeout(() => { const r = box.getBoundingClientRect(); if (r.bottom > innerHeight - 100) box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 330);
    },
    copycmd: (el) => RB.copy(el.dataset.v, 'Perintah disalin'),
    contact: openContact,
    copytoken: (el) => RB.copy(el.dataset.v, 'Token disalin'),
    vieworder: (el) => openOrder(el.dataset.id),
    tokenpage: () => { S.tab = 'account'; S.fresh = true; render(); window.scrollTo(0, 0); if (!S.me.token) ACT.tokenredeem(); },
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
      try { await RB.api('settings', { body: { autoDl: next } }); el.classList.toggle('on', next); el.setAttribute('aria-checked', next); S.me.autoDl = next; const d = el.parentElement.querySelector('.xs'); if (d) d.textContent = next ? 'Aktif: media view once tersimpan otomatis' : 'Nonaktif: kamu harus mengetik .dl manual'; const h = document.querySelector('[data-mod="dl"] .mod-h .badge'); if (h) { h.className = 'badge ' + (next ? 'ok' : ''); h.lastChild.textContent = next ? 'Auto ON' : 'Auto OFF'; } RB.toast(next ? 'Auto DL aktif' : 'Auto DL nonaktif', 'ok'); } catch (e) { RB.fail(e); }
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
