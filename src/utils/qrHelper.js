const fs = require('fs');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const qrcodeTerminal = require('qrcode-terminal');
const logger = require('./logger');

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

    // Parse PNG và giải mã nội dung QR để in ra Terminal
    try {
      const png = PNG.sync.read(buffer);
      const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

      if (code && code.data) {
        console.log('\n' + '='.repeat(45));
        console.log('📱 HÃY DÙNG APP ZALO TRÊN ĐIỆN THOẠI ĐỂ QUÉT MÃ NÀY:');
        console.log('='.repeat(45) + '\n');
        
        qrcodeTerminal.generate(code.data, { small: true });
        
        console.log('\n' + '='.repeat(45));
        console.log(`(Nếu mã QR trong terminal bị vỡ, bạn hãy mở trực tiếp file ảnh: ${savePath})`);
        console.log('='.repeat(45) + '\n');
      } else {
        logger.warn(`Không thể đọc mã QR từ dữ liệu ảnh. Vui lòng mở file '${savePath}' để quét.`);
      }
    } catch (err) {
      logger.warn(`Không thể vẽ QR ra terminal: ${err.message}. Vui lòng mở file '${savePath}' để quét.`);
    }
  } catch (err) {
    logger.error('Lỗi khi lưu mã QR:', err);
  }
}

module.exports = {
  renderAndSaveQR,
};
