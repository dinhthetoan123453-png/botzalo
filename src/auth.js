const fs = require('fs');
const { Zalo, LoginQRCallbackEventType } = require('zca-js');
const { imageSize } = require('image-size');
const config = require('./config');
const logger = require('./utils/logger');
const { renderAndSaveQR } = require('./utils/qrHelper');

/**
 * Hàm lấy metadata của ảnh để zca-js hỗ trợ gửi ảnh qua đường dẫn file
 */
async function imageMetadataGetter(filePath) {
  try {
    const data = await fs.promises.readFile(filePath);
    const dim = imageSize(data);
    return {
      height: dim.height,
      width: dim.width,
      size: data.length,
    };
  } catch (err) {
    logger.error('Lỗi khi đọc metadata ảnh:', err.message);
    return null;
  }
}

/**
 * Xử lý đăng nhập tài khoản Zalo cá nhân
 * Ưu tiên dùng session đã lưu từ trước. Nếu chưa có hoặc hết hạn sẽ quét QR.
 */
async function authenticate() {
  const zalo = new Zalo({
    selfListen: true,
    imageMetadataGetter,
  });

  // 1. Kiểm tra session từ biến môi trường ZALO_SESSION hoặc file session.json đã lưu trước đó
  let sessionData = null;

  if (process.env.ZALO_SESSION) {
    try {
      logger.info('Tìm thấy cấu hình ZALO_SESSION từ biến môi trường...');
      let str = process.env.ZALO_SESSION.trim();

      // Trường hợp 1: Dạng chuỗi mã hóa Base64
      if (!str.startsWith('{') && !str.startsWith('[') && !str.startsWith('"')) {
        try {
          const decoded = Buffer.from(str, 'base64').toString('utf8');
          if (decoded.startsWith('{')) {
            str = decoded;
          }
        } catch (_) {}
      }

      // Trường hợp 2: Bị bọc dấu nháy kép hoặc nháy đơn ngoài cùng do copy trên web
      if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1);
      }

      // Trường hợp 3: Bị escape dấu ngoặc kép
      if (str.includes('\\"')) {
        str = str.replace(/\\"/g, '"');
      }

      let parsed = JSON.parse(str);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      sessionData = parsed;
    } catch (e) {
      logger.warn(`Biến môi trường ZALO_SESSION không phải là chuỗi JSON hợp lệ (${e.message}).`);
    }
  }

  if (!sessionData && fs.existsSync(config.sessionPath)) {
    try {
      logger.info('Tìm thấy file session.json, đang thử đăng nhập bằng cookie...');
      sessionData = JSON.parse(fs.readFileSync(config.sessionPath, 'utf8'));
    } catch (err) {
      logger.warn(`Đọc file session.json thất bại: ${err.message}. Chuyển sang quét mã QR...`);
      try {
        fs.unlinkSync(config.sessionPath);
      } catch (_) {}
    }
  }

  if (sessionData && sessionData.cookie && sessionData.imei) {
    try {
      const api = await zalo.login({
        cookie: sessionData.cookie,
        imei: sessionData.imei,
        userAgent: sessionData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
        language: 'vi',
      });

      logger.success('Đăng nhập thành công từ session!');
      return api;
    } catch (loginErr) {
      logger.warn(`Đăng nhập bằng session thất bại: ${loginErr.message}. Chuyển sang quét mã QR...`);
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
          logger.info('Đã nhận diện quét mã! Vui lòng ấn [Xác nhận đăng nhập] trên điện thoại của bạn...');
          break;
        }

        case LoginQRCallbackEventType.GotLoginInfo: {
          try {
            fs.writeFileSync(config.sessionPath, JSON.stringify(event.data, null, 2), 'utf8');
            logger.success('Đã lưu phiên đăng nhập vào session.json! (Lần khởi động sau sẽ tự động đăng nhập)');
            const b64 = Buffer.from(JSON.stringify(event.data)).toString('base64');
            console.log('\n' + '='.repeat(60));
            console.log('📌 MÃ PHIÊN ZALO_SESSION MỚI (LƯU VÀO BIẾN MÔI TRƯỜNG TRÊN RENDER):');
            console.log(b64);
            console.log('='.repeat(60) + '\n');
          } catch (saveErr) {
            logger.error('Lỗi khi ghi file session.json:', saveErr);
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeExpired: {
          logger.warn('Mã QR đã hết hạn, hệ thống đang tự động tạo lại mã mới...');
          if (event.actions && typeof event.actions.retry === 'function') {
            event.actions.retry();
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeDeclined: {
          logger.error('Bạn đã từ chối xác nhận đăng nhập trên thiết bị điện thoại.');
          break;
        }

        default:
          break;
      }
    }
  );

  logger.success('Đăng nhập Zalo thành công!');
  try {
    if (fs.existsSync(config.qrPath)) {
      fs.unlinkSync(config.qrPath);
    }
  } catch (_) {}
  return api;
}

module.exports = {
  authenticate,
};
