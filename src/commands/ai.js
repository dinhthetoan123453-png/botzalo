const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const logger = require('../utils/logger');

let aiClient = null;
if (config.geminiApiKey) {
  aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
}

module.exports = {
  name: 'ai',
  description: 'Hoi dap voi tri tue nhan tao (Google Gemini)',
  usage: '!ai <cau hoi>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: 'Vui long nhap cau hoi sau lenh !ai. Vi du: !ai giai thich tai sao bau troi mau xanh?',
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
          msg: 'Tinh nang AI chua duoc cau hinh.\nBan vui long mo file .env va dien GEMINI_API_KEY (lay tai https://aistudio.google.com/app/apikey).',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    const prompt = args.join(' ');

    try {
      const response = await aiClient.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
      });

      const replyText = response.text || 'Khong nhan duoc cau tra loi tu AI.';

      await api.sendMessage(
        {
          msg: `Tra loi:\n\n${replyText}`,
          quote: message.data,
        },
        threadId,
        threadType
      );
    } catch (err) {
      logger.error('Loi khi goi Gemini API:', err);
      await api.sendMessage(
        {
          msg: `Loi xu ly AI: ${err.message || 'Khong the ket noi den may chu AI.'}`,
          quote: message.data,
        },
        threadId,
        threadType
      );
    }
  },
};
