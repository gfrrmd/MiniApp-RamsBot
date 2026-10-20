# RamsBot Mini App

Website Telegram Mini App untuk RamsBot, siap deploy di Vercel dan terhubung ke database PostgreSQL Railway yang sama dengan bot.

Isi aplikasi:
- Login dengan Telegram otomatis (initData divalidasi HMAC di server, tanpa kata sandi).
- Beranda: status VIP, sisa masa aktif, status session, akses cepat.
- Beli VIP: daftar paket, kode promo, QRIS dinamis, unggah bukti bayar, riwayat pesanan.
- Fitur: Auto DL view once, QRIS dinamis pribadi, blacklist broadcast, auto block leaver, panduan perintah.
- Akun: token VIP (lihat, salin, pindahkan VIP), klaim voucher, trial.
- Console admin (terpisah dan tersembunyi): ringkasan, pesanan (approve, tolak, batalkan), user, paket, promo, voucher, pembayaran, siaran, blacklist.
- Tema dark premium, tanpa emoji, ikon SVG.

## Prasyarat

1. Bot **RamsBot V2 Token dan Promo** (versi terbaru) sudah berjalan di Railway. Tabel token, promo, dan voucher dibuat oleh bot saat start, dan Mini App membutuhkannya.
2. Terapkan juga file bot yang diperbarui (`RamsBot V2 (update Mini App).zip`): sinkronisasi session otomatis, deep link `/start setup`, dan tombol Mini App.
3. Akun Vercel dan repositori Git (GitHub, GitLab, atau Bitbucket), atau Vercel CLI.

## Langkah deploy

### 1. Ambil URL database Railway (PUBLIK)
Di Railway buka service PostgreSQL, tab **Variables**, salin nilai **`DATABASE_PUBLIC_URL`**.
Jangan pakai `DATABASE_URL` yang berisi `postgres.railway.internal`, karena alamat itu hanya bisa diakses dari dalam Railway dan tidak bisa dijangkau Vercel.

### 2. Deploy ke Vercel
Cara GitHub: upload folder ini ke repositori, lalu di Vercel pilih **Add New Project**, impor repositorinya, Framework Preset biarkan **Other**, tanpa Build Command dan tanpa Output Directory.
Cara CLI: `npm i -g vercel`, lalu `vercel --prod` di folder ini.

### 3. Isi Environment Variables (Vercel, Project Settings, Environment Variables)

| Nama | Wajib | Isi |
|---|---|---|
| `BOT_TOKEN` | ya | Token bot, sama dengan `BOT_TOKEN` di bot |
| `ADMIN_ID` | ya | ID Telegram admin, sama dengan `ADMIN_ID` di bot |
| `DATABASE_URL` | ya | Isi dengan `DATABASE_PUBLIC_URL` dari Railway |
| `BOT_USERNAME` | ya | Username bot tanpa @ |
| `SESSION_SECRET` | disarankan | String acak panjang untuk menandatangani sesi |
| `ADMIN_CONTACT` | opsional | Contoh `@kqrbit` |
| `BRAND_NAME` | opsional | Nama di header (default RamsBot) |
| `TRIAL_MINUTES` | opsional | Lama trial, default 5 |
| `DATABASE_SSL` | opsional | Isi `off` hanya jika database tidak memakai SSL |

Setelah mengisi variabel, lakukan **Redeploy**. Catat URL produksinya, misalnya `https://ramsbot.vercel.app`.

### 4. Hubungkan ke bot
1. Di **@BotFather**: `/mybots`, pilih bot, **Bot Settings**, **Menu Button**, **Configure menu button**, kirim URL Vercel kamu. Tombol menu di chat bot akan membuka Mini App.
2. Di Railway (service bot) tambahkan variabel **`WEBAPP_URL`** dengan isi URL Vercel tanpa garis miring di akhir, lalu restart bot. Menu utama bot akan memiliki tombol **Buka Mini App**, dan Panel Admin memiliki tombol **Console Web**.

### 5. Console admin
- Buka dari **Panel Admin bot, tombol Console Web**. Tidak ada link ke Console di Mini App pengguna.
- Alamatnya `/console`. Siapa pun selain `ADMIN_ID` hanya melihat halaman `404 Not Found`, dan semua API `/api/admin/*` juga membalas 404 bagi non-admin.
- Sesi admin berlaku 2 jam, setelah itu otomatis masuk ulang selama dibuka dari Telegram.
- Ingin mengganti alamat Console? Ubah nama folder `public/console` dan aturan `/console` di `vercel.json`, lalu sesuaikan `WEBAPP_URL + "/console"` di `keyboards.py` bot.

## Cara kerja dan batasan

- **Pembelian**: pesanan dan QRIS dinamis dibuat sama persis dengan bot (kode unik, batas waktu, promo, 100% gratis).
- **Verifikasi pembayaran**: di halaman pesanan ada tombol **Verifikasi otomatis lewat bot**. Tombol itu membuka bot dengan deep link `/start pay_<id>`, user mengirim bukti di sana, dan bot memprosesnya dengan alur yang sama seperti pembelian di bot (OCR auto-verifikasi, cek bukti ganda, daftar wajib-manual). Jika OCR belum diaktifkan admin atau nominal tidak cocok, bukti diteruskan ke admin. Halaman pesanan di Mini App memperbarui status otomatis begitu bot mengonfirmasi. Tersedia juga **Unggah bukti ke admin (manual)** langsung dari Mini App, yang bisa disetujui lewat tombol Approve di chat bot atau Console.
- **Setup session** (login nomor, kode OTP) tetap lewat bot karena memerlukan Telethon. Tombol **Setup lewat bot** di Mini App membuka bot dengan deep link.
- **Session otomatis aktif**: setelah VIP aktif lewat web (approve, voucher, token), bot menyalakan session user dalam sekitar 1 menit lewat scheduler. Saat VIP dicabut atau dipindah, session dimatikan.
- **Notifikasi**: konfirmasi pembayaran, token, penolakan, dan pengumuman dikirim lewat Bot API dari server.
- **Token VIP**: semua aturan sama dengan bot (maks 3 kali, kode berganti saat beli lagi, pembatalan order mengikuti rantai perpindahan).
- **Anti tebak kode**: 6 kode salah dalam 10 menit mengunci input token, voucher, dan promo selama 15 menit (tersimpan di database, aman untuk serverless).

## Keamanan

- Login divalidasi dengan HMAC-SHA256 sesuai dokumentasi Telegram, tanda tangan dibandingkan dengan `timingSafeEqual`, `auth_date` maksimal 24 jam.
- Sesi memakai token bertanda tangan HMAC (8 jam untuk user, 2 jam untuk admin). Hak admin hanya berlaku jika ID sama dengan `ADMIN_ID`.
- Semua query memakai parameter terikat (tanpa penyambungan string), seluruh keluaran HTML di-escape, ada Content-Security-Policy ketat di `vercel.json`.
- Perubahan status penting (setujui, klaim voucher, pindah token, kuota promo) berjalan dalam satu transaksi database.
- Rahasia (`BOT_TOKEN`, `DATABASE_URL`) hanya ada di environment variable server, tidak pernah dikirim ke browser.

## Struktur

```
api/router.js          satu fungsi serverless untuk semua endpoint /api/*
lib/auth.js            validasi initData Telegram dan sesi
lib/core.js            logika bisnis (langganan, token, promo, voucher, pesanan)
lib/routes_user.js     endpoint pengguna
lib/routes_admin.js    endpoint admin (404 bagi non-admin)
lib/qris.js            konversi QRIS statis ke dinamis (port dari bot)
public/                Mini App (index.html, app.js, common.js, style.css)
public/console/        Console admin
tests/run.js           tes unit tanpa dependensi (npm test)
```

## Pengembangan dan tes

`npm install` lalu `npm test` menjalankan tes unit (QRIS, validasi login, sesi, helper kode).
Mini App hanya berfungsi di dalam Telegram, karena identitas pengguna berasal dari initData yang ditandatangani Telegram.

## Pemecahan masalah

- **"Buka lewat Telegram"**: halaman dibuka di browser biasa. Buka lewat tombol menu bot.
- **Error 500 saat login**: cek `DATABASE_URL` (harus URL publik) dan `BOT_TOKEN`. Log ada di Vercel, tab Logs.
- **Tabel tidak ditemukan**: bot versi V2 Token dan Promo belum pernah dijalankan pada database ini.
- **Latensi tinggi**: pilih Function Region Vercel yang dekat dengan region database Railway (Project Settings, Functions).
