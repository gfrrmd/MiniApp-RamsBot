const QRCode = require('qrcode');

// SVG dibuat di server; selalu hitam di atas putih agar terbaca oleh aplikasi pembayaran.
module.exports = (text) =>
  QRCode.toString(text, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
