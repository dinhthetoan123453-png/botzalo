const logger = require('./logger');

/**
 * Gửi tin nhắn an toàn qua Zalo:
 * Tự động dự phòng nếu lỗi do tính năng trích dẫn tin nhắn (quote) không được hỗ trợ
 * trên một số loại tin nhắn (tin nhắn liên kết, cloud của tôi, bình chọn,...)
 */
async function safeSendMessage(api, payload, threadId, threadType) {
  try {
    return await api.sendMessage(payload, threadId, threadType);
  } catch (err) {
    if (payload && payload.quote) {
      logger.warn(`Gửi tin nhắn kèm quote thất bại (${err.message}). Đang tự động gửi lại không có quote...`);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.quote;
      try {
        return await api.sendMessage(fallbackPayload, threadId, threadType);
      } catch (innerErr) {
        logger.error('Thử lại gửi tin nhắn không kèm quote vẫn thất bại:', innerErr.message || innerErr);
        throw innerErr;
      }
    }
    throw err;
  }
}

module.exports = {
  safeSendMessage,
};
