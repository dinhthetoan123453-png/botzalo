const fs = require('fs');
const { Zalo, LoginQRCallbackEventType } = require('zca-js');
const config = require('./config');
const logger = require('./utils/logger');
const { renderAndSaveQR } = require('./utils/qrHelper');

/**
 * Xử lý đăng nhập tài khoản Zalo cá nhân
 * Ưu tiên dùng session đã lưu từ trước. Nếu chưa có hoặc hết hạn sẽ quét QR.
 */
async function authenticate() {
  const zalo = new Zalo();

  // 1. Kiểm tra session.json đã lưu trước đó
  if (fs.existsSync(config.sessionPath)) {
    try {
      logger.info('Tìm thấy file session.json, đang thử đăng nhập bằng cookie...');
      const sessionData = JSON.parse(fs.readFileSync(config.sessionPath, 'utf8'));

      if (sessionData && sessionData.cookie && sessionData.imei) {
        const api = await zalo.login({
          cookie: sessionData.cookie,
          imei: sessionData.imei,
          userAgent: sessionData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
          language: 'vi',
        });

        logger.success('Đăng nhập thành công từ session.json!');
        return api;
      }
    } catch (err) {
      logger.warn(`Đăng nhập bằng session cũ thất bại: ${err.message}. Chuyển sang quét mã QR...`);
      try {
        fs.unlinkSync(config.sessionPath);
      } catch (_) {}
    }
  }

  // 2. Nếu không có session hoặc session hết hạn -> Đăng nhập bằng mã QR
  logger.info('Khởi tạo đăng nhập bằng mã QR...');

  const api = await zalo.loginQR(
    {
      language: 'vi',
      qrPath: config.qrPath,
    },
    (event) => {
      switch (event.type) {
        case LoginQRCallbackEventType.QRCodeGenerated: {
          logger.info('Mã QR đăng nhập đã được tạo.');
          if (event.data && event.data.image) {
            renderAndSaveQR(event.data.image, config.qrPath);
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeScanned: {
          logger.info('✅ Đã nhận diện quét mã! Vui lòng ấn [Xác nhận đăng nhập] trên điện thoại của bạn...');
          break;
        }

        case LoginQRCallbackEventType.GotLoginInfo: {
          try {
            fs.writeFileSync(config.sessionPath, JSON.stringify(event.data, null, 2), 'utf8');
            logger.success('✅ Đã lưu phiên đăng nhập vào session.json! (Lần khởi động sau sẽ tự động đăng nhập)');
          } catch (saveErr) {
            logger.error('Lỗi khi ghi file session.json:', saveErr);
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeExpired: {
          logger.warn('⏳ Mã QR đã hết hạn, hệ thống đang tự động tạo lại mã mới...');
          if (event.actions && typeof event.actions.retry === 'function') {
            event.actions.retry();
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeDeclined: {
          logger.error('❌ Bạn đã từ chối xác nhận đăng nhập trên thiết bị điện thoại.');
          break;
        }

        default:
          break;
      }
    }
  );

  logger.success('Đăng nhập Zalo thành công!');
  return api;
}

module.exports = {
  authenticate,
};
