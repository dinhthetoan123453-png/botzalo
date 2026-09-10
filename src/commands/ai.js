const { GoogleGenAI } = require('@google/genai');
const { ThreadType } = require('zca-js');
const config = require('../config');
const logger = require('../utils/logger');
const chatHistory = require('../utils/chatHistory');

let aiClient = null;
if (config.geminiApiKey) {
  aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
}

module.exports = {
  name: 'ai',
  description: 'Hỏi đáp với AI Google Gemini (đọc 8 tin nhắn gần nhất để tối ưu câu trả lời)',
  usage: '!ai [câu hỏi hoặc để trống để AI phản hồi theo ngữ cảnh]',
  async execute({ api, message, args, threadId, threadType, isAutoReply = false }) {
    if (!config.geminiApiKey) {
      await api.sendMessage(
        {
          msg: 'Tính năng AI chưa được cấu hình.\nBạn vui lòng mở file .env và điền GEMINI_API_KEY (lấy miễn phí tại https://aistudio.google.com/app/apikey).',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    if (!aiClient) {
      aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }

    const hasArgs = Boolean(args && args.length > 0);
    const userPrompt = hasArgs ? args.join(' ').trim() : '';
    const senderName = message.data?.dName || 'Người dùng';
    const isGroup = threadType === ThreadType.Group;
    const historyLimit = config.aiHistoryLimit || 8;

    try {
      // 1. Lấy lịch sử 8 tin nhắn gần nhất trong cuộc hội thoại (kèm Zalo Group API nếu cần)
      const fullHistory = await chatHistory.getHistoryWithFallback(api, threadId, isGroup, historyLimit + 2);

      // Lọc bỏ tin nhắn kích hoạt hiện tại để không bị trùng lặp ngữ cảnh
      const rawCurrent = message.data?.content?.trim() || '';
      const previousMessages = fullHistory
        .filter(m => {
          if (!m || !m.content) return false;
          if (m.content === rawCurrent) return false;
          if (rawCurrent.startsWith(config.prefix) && m.content.startsWith(config.prefix)) return false;
          return true;
        })
        .slice(-historyLimit);

      // Kiểm tra nếu không có câu hỏi VÀ cũng chưa có bất kỳ tin nhắn lịch sử nào
      if (!userPrompt && previousMessages.length === 0) {
        await api.sendMessage(
          {
            msg: 'Vui lòng nhập câu hỏi sau lệnh !ai (Ví dụ: !ai giải thích tại sao bầu trời màu xanh?) hoặc trò chuyện trước để AI nắm bắt ngữ cảnh.',
            quote: message.data,
          },
          threadId,
          threadType
        );
        return;
      }

      // 2. Xây dựng prompt chứa bối cảnh 8 tin nhắn gần nhất
      let contents = '';
      if (previousMessages.length > 0) {
        const historyText = chatHistory.formatForPrompt(previousMessages);
        if (isAutoReply) {
          contents = `[BỐI CẢNH ${previousMessages.length} TIN NHẮN GẦN NHẤT TRONG CUỘC TRÒ CHUYỆN]:\n${historyText}\n\n[YÊU CẦU]:\nBạn là chủ tài khoản Zalo đang trò chuyện với "${senderName}". Hãy đọc kỹ các tin nhắn trên và viết câu trả lời phản hồi lại tin nhắn mới nhất một cách tự nhiên, thân thiện, ngắn gọn như người thật đang nhắn tin.`;
        } else if (userPrompt) {
          contents = `[BỐI CẢNH ${previousMessages.length} TIN NHẮN GẦN NHẤT TRONG CUỘC TRÒ CHUYỆN]:\n${historyText}\n\n[CÂU HỎI / YÊU CẦU MỚI NHẤT TỪ "${senderName}"]:\n"${userPrompt}"\n\nHãy phân tích kỹ bối cảnh các tin nhắn trên để trả lời câu hỏi mới nhất một cách tối ưu, tự nhiên, chính xác và súc tích nhất cho tin nhắn Zalo.`;
        } else {
          contents = `[BỐI CẢNH ${previousMessages.length} TIN NHẮN GẦN NHẤT TRONG CUỘC TRÒ CHUYỆN]:\n${historyText}\n\n[YÊU CẦU]:\nNgười dùng "${senderName}" vừa gọi AI hỗ trợ. Hãy phân tích kỹ các tin nhắn gần nhất trên và đưa ra câu trả lời hoặc phản hồi tối ưu nhất để tiếp nối, giải quyết vấn đề mọi người đang bàn luận trong cuộc trò chuyện.`;
        }
      } else {
        contents = userPrompt;
      }

      // 3. Gọi Gemini API với chỉ dẫn hệ thống tối ưu phong cách chat Zalo
      const response = await aiClient.models.generateContent({
        model: config.geminiModel,
        contents,
        config: {
          systemInstruction: `Bạn là trợ lý AI thông minh trên ứng dụng Zalo.
Nhiệm vụ của bạn: Đọc và hiểu sâu 8 tin nhắn gần nhất để tối ưu câu trả lời cho người dùng.

Quy tắc phản hồi tối ưu:
- Hiểu ngữ cảnh: Nhận diện chủ đề đang bàn luận, xưng hô phù hợp, giải mã các đại từ thay thế (ví dụ: "chỗ đó", "nó", "quán đấy", "ai", "bao nhiêu").
- Phong cách nhắn tin Zalo: Trả lời bằng tiếng Việt tự nhiên, thân thiện, ngắn gọn, súc tích, đi thẳng vào trọng tâm (1-3 câu hoặc vài gạch đầu dòng rõ ràng).
- Tuyệt đối không lặp lại máy móc danh sách các tin nhắn cũ và không nói các câu sáo rỗng như "dựa trên 8 tin nhắn...".
- Trực tiếp giải quyết câu hỏi hoặc nhu cầu của người dùng.`,
        },
      });

      const replyText = response.text?.trim() || 'Không nhận được câu trả lời từ AI.';

      // 4. Lưu câu hỏi của người dùng (nếu có) và câu trả lời của AI vào lịch sử để duy trì mạch hội thoại
      if (userPrompt) {
        chatHistory.addMessage(threadId, {
          sender: senderName,
          content: userPrompt,
          isSelf: message.isSelf,
          timestamp: Number(message.data?.ts) || Date.now(),
        });
      }

      chatHistory.addMessage(threadId, {
        sender: 'Bot (Bạn)',
        content: replyText,
        isSelf: true,
        timestamp: Date.now(),
      });

      // 5. Gửi câu trả lời về cho người dùng qua Zalo
      await api.sendMessage(
        {
          msg: replyText,
          quote: message.data,
        },
        threadId,
        threadType
      );
    } catch (err) {
      logger.error('Lỗi khi gọi Gemini API:', err);
      await api.sendMessage(
        {
          msg: `Lỗi xử lý AI: ${err.message || 'Không thể kết nối đến máy chủ AI.'}`,
          quote: message.data,
        },
        threadId,
        threadType
      );
    }
  },
};
