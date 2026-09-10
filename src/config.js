const path = require('path');
require('dotenv').config();

module.exports = {
  prefix: process.env.BOT_PREFIX || '!',
  autoReplyAi: process.env.AUTO_REPLY_AI === 'true',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  safeDelayMin: parseInt(process.env.SAFE_DELAY_MIN, 10) || 1000,
  safeDelayMax: parseInt(process.env.SAFE_DELAY_MAX, 10) || 2500,
  aiHistoryLimit: parseInt(process.env.AI_HISTORY_LIMIT, 10) || 8,
  sessionPath: path.resolve(__dirname, '../session.json'),
  qrPath: path.resolve(__dirname, '../qr.png'),
};
