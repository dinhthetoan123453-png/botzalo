const fs = require('fs');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const qrcodeTerminal = require('qrcode-terminal');
const logger = require('./logger');

/**
 * Upload ảnh QR lên host tạm thời để người dùng có thể mở link trên điện thoại/trình duyệt
 */
async function uploadToTempHost(buffer) {
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('file', blob, 'qr.png');
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (json && json.data && json.data.url) {
      return json.data.url;
    }
  } catch (err) {
    logger.warn('Không thể upload ảnh QR lên host tạm:', err.message);
  }
  return null;
}

/**
 * Hiển thị mã QR trực tiếp trong Terminal và lưu ảnh ra file
 * @param {string} base64Data - Dữ liệu ảnh dạng base64 (đã bỏ tiền tố data:image/png;base64,)
 * @param {string} savePath - Đường dẫn file để lưu ảnh qr.png
 */
async function renderAndSaveQR(base64Data, savePath) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Lưu file ảnh qr.png
    fs.writeFileSync(savePath, buffer);
    logger.info(`Đã lưu ảnh mã QR tại: \x1b[36m${savePath}\x1b[0m`);

    // Tải ảnh lên host tạm và lấy link web trực tiếp để quét
    const tempUrl = await uploadToTempHost(buffer);
    const renderUrl = process.env.RENDER_EXTERNAL_URL;

    console.log('\n' + '='.repeat(60));
    console.log('👉 BẤM VÀO LINK NÀY ĐỂ XEM VÀ QUÉT MÃ QR TRÊN ĐIỆN THOẠI:');
    if (tempUrl) {
      console.log(`🔗 Link ảnh online: \x1b[32m\x1b[1m${tempUrl}\x1b[0m`);
    }
    if (renderUrl) {
      console.log(`🔗 Link web Render: \x1b[36m\x1b[1m${renderUrl}\x1b[0m`);
    }
    console.log('='.repeat(60) + '\n');

    // Parse PNG và giải mã nội dung QR để in ra Terminal
    try {
      const png = PNG.sync.read(buffer);
      const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

      if (code && code.data) {
        console.log('HÃY DÙNG APP ZALO TRÊN ĐIỆN THOẠI ĐỂ QUÉT MÃ NÀY (hoặc mở link ở trên):');
        qrcodeTerminal.generate(code.data, { small: true });
      }
    } catch (err) {
      // Bỏ qua nếu terminal không hỗ trợ vẽ QR
    }
  } catch (err) {
    logger.error('Lỗi khi xử lý mã QR:', err);
  }
}

module.exports = {
  renderAndSaveQR,
};
