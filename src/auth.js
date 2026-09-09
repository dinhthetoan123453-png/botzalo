const fs = require('fs');
const { Zalo, LoginQRCallbackEventType } = require('zca-js');
const { imageSize } = require('image-size');
const config = require('./config');
const logger = require('./utils/logger');
const { renderAndSaveQR } = require('./utils/qrHelper');

/**
 * Ham lay metadata cua anh de zca-js ho tro gui anh qua duong dan file
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
    logger.error('Loi khi doc metadata anh:', err.message);
    return null;
  }
}

/**
 * Xu ly dang nhap tai khoan Zalo ca nhan
 * Uu tien dung session da luu tu truoc. Neu chua co hoac het han se quet QR.
 */
async function authenticate() {
  const zalo = new Zalo({
    selfListen: true,
    imageMetadataGetter,
  });

  // 1. Kiem tra session.json da luu truoc do
  if (fs.existsSync(config.sessionPath)) {
    try {
      logger.info('Tim thay file session.json, dang thu dang nhap bang cookie...');
      const sessionData = JSON.parse(fs.readFileSync(config.sessionPath, 'utf8'));

      if (sessionData && sessionData.cookie && sessionData.imei) {
        const api = await zalo.login({
          cookie: sessionData.cookie,
          imei: sessionData.imei,
          userAgent: sessionData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
          language: 'vi',
        });

        logger.success('Dang nhap thanh cong tu session.json!');
        return api;
      }
    } catch (err) {
      logger.warn(`Dang nhap bang session cu that bai: ${err.message}. Chuyen sang quet ma QR...`);
      try {
        fs.unlinkSync(config.sessionPath);
      } catch (_) {}
    }
  }

  // 2. Neu khong co session hoac session het han -> Dang nhap bang ma QR
  logger.info('Khoi tao dang nhap bang ma QR...');

  const api = await zalo.loginQR(
    {
      language: 'vi',
      qrPath: config.qrPath,
    },
    (event) => {
      switch (event.type) {
        case LoginQRCallbackEventType.QRCodeGenerated: {
          logger.info('Ma QR dang nhap da duoc tao.');
          if (event.data && event.data.image) {
            renderAndSaveQR(event.data.image, config.qrPath);
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeScanned: {
          logger.info('Da nhan dien quet ma! Vui long an [Xac nhan dang nhap] tren dien thoai cua ban...');
          break;
        }

        case LoginQRCallbackEventType.GotLoginInfo: {
          try {
            fs.writeFileSync(config.sessionPath, JSON.stringify(event.data, null, 2), 'utf8');
            logger.success('Da luu phien dang nhap vao session.json! (Lan khoi dong sau se tu dong dang nhap)');
          } catch (saveErr) {
            logger.error('Loi khi ghi file session.json:', saveErr);
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeExpired: {
          logger.warn('Ma QR da het han, he thong dang tu dong tao lai ma moi...');
          if (event.actions && typeof event.actions.retry === 'function') {
            event.actions.retry();
          }
          break;
        }

        case LoginQRCallbackEventType.QRCodeDeclined: {
          logger.error('Ban da tu choi xac nhan dang nhap tren thiet bi dien thoai.');
          break;
        }

        default:
          break;
      }
    }
  );

  logger.success('Dang nhap Zalo thanh cong!');
  return api;
}

module.exports = {
  authenticate,
};
