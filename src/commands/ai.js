const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const logger = require('../utils/logger');

let aiClient = null;
if (config.geminiApiKey) {
  aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
}

module.exports = {
  name: 'ai',
  description: 'Hỏi đáp thông minh với trí tuệ nhân tạo (Google Gemini)',
  usage: '!ai <câu hỏi của bạn>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: '❓ Vui lòng nhập câu hỏi sau lệnh !ai. Ví dụ: !ai giải thích tại sao bầu trời màu xanh?',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    if (!config.geminiApiKey || !aiClient) {
      await api.sendMessage(
        {
          msg: '⚠️ Tính năng AI chưa được cấu hình.\nBạn vui lòng mở file .env và điền GEMINI_API_KEY (lấy miễn phí tại https://aistudio.google.com/app/apikey).',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    const prompt = args.join(' ');

    try {
      // Gửi thông báo đang xử lý nếu cần hoặc gọi API trực tiếp
      const response = await aiClient.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
      });

      const replyText = response.text || 'Không nhận được câu trả lời từ AI.';

      await api.sendMessage(
        {
          msg: `🤖 Trả lời:\n\n${replyText}`,
          quote: message.data,
        },
        threadId,
        threadType
      );
    } catch (err) {
      logger.error('Lỗi khi gọi Gemini API:', err);
      await api.sendMessage(
        {
          msg: `❌ Lỗi xử lý AI: ${err.message || 'Không thể kết nối đến máy chủ AI.'}`,
          quote: message.data,
        },
        threadId,
        threadType
      );
    }
  },
};
