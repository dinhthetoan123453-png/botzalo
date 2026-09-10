const { ThreadType } = require('zca-js');
const config = require('./config');
const logger = require('./utils/logger');
const chatHistory = require('./utils/chatHistory');
const { commands, loadCommands } = require('./commands');

/**
 * Hàm tạo khoảng nghỉ ngẫu nhiên để mô phỏng hành vi gõ phím của người thật,
 * tránh bị Zalo đánh dấu là tài khoản spam/bot.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Khởi động lắng nghe tin nhắn và xử lý lệnh
 * @param {import('zca-js').API} api
 */
function startBot(api) {
  // Bọc api.sendMessage để tự động thử lại khi tính năng quote (trích dẫn) bị lỗi ở một số hội thoại (ví dụ Cloud của tôi)
  const originalSendMessage = api.sendMessage.bind(api);
  api.sendMessage = async function (content, threadId, threadType) {
    try {
      return await originalSendMessage(content, threadId, threadType);
    } catch (err) {
      if (typeof content === 'object' && content.quote) {
        logger.warn(`Không thể gửi tin nhắn dạng trích dẫn (${err.message}). Đang chuyển sang gửi tin nhắn thường...`);
        return await originalSendMessage({ msg: content.msg }, threadId, threadType);
      }
      throw err;
    }
  };

  // 1. Tải toàn bộ danh sách lệnh
  loadCommands();

  // 2. Lắng nghe các sự kiện kết nối của listener
  api.listener.on('connected', () => {
    logger.success('WebSocket đã kết nối tới máy chủ Zalo!');
    logger.bot(`Bot đang lắng nghe tin nhắn với tiền tố: [ ${config.prefix} ]`);
  });

  api.listener.on('disconnected', (code, reason) => {
    logger.warn(`Mất kết nối tới máy chủ Zalo (Mã: ${code}, Lý do: ${reason || 'Không rõ'})`);
  });

  api.listener.on('closed', (code, reason) => {
    logger.warn(`WebSocket đã đóng (Mã: ${code}, Lý do: ${reason || 'Không rõ'}). Chú ý: Nếu bạn mở Zalo trên trình duyệt cùng lúc, kết nối bot sẽ tự động ngắt.`);
  });

  api.listener.on('error', (err) => {
    logger.error('Lỗi WebSocket listener:', err);
  });

  // 3. Xử lý tin nhắn đến
  api.listener.on('message', async (message) => {
    try {
      // Chỉ xử lý tin nhắn dạng văn bản
      if (!message.data || typeof message.data.content !== 'string') return;

      const rawContent = message.data.content.trim();
      const senderName = message.data.dName || 'Ai đó';
      const threadId = message.threadId;
      const threadType = message.type;
      const isGroup = threadType === ThreadType.Group;
      const isSelf = message.isSelf;

      // In log tin nhắn nhận được ra terminal để bạn dễ dàng theo dõi theo thời gian thực
      logger.msg(`[${isGroup ? 'Nhóm' : (isSelf ? 'Chính mình' : 'Riêng')}] ${senderName}: "${rawContent}"`);

      // Lưu các tin nhắn thông thường vào lịch sử (chatHistory) để AI nắm bắt ngữ cảnh 8 tin nhắn gần nhất.
      // Bỏ qua các tin nhắn bắt đầu bằng tiền tố lệnh (!ping, !help, !ai...) để không làm bẩn ngữ cảnh hội thoại.
      const isCommand = rawContent.startsWith(config.prefix);
      if (!isCommand) {
        chatHistory.addMessage(threadId, {
          sender: isSelf ? 'Bot (Bạn)' : senderName,
          content: rawContent,
          isSelf,
          timestamp: Number(message.data?.ts) || Date.now(),
        });
      }

      // Kiểm tra xem tin nhắn có bắt đầu bằng tiền tố lệnh không (ví dụ: !ping, !help, !ai)
      if (isCommand) {
        const fullCommand = rawContent.slice(config.prefix.length).trim();
        const args = fullCommand.split(/\s+/);
        const commandName = args.shift().toLowerCase();

        const command = commands.get(commandName);
        if (command) {
          logger.bot(`Thực thi lệnh '${commandName}' từ [${senderName}] (Thread: ${threadId})`);

          // Giả lập độ trễ an toàn trước khi trả lời
          const delay = getRandomDelay(config.safeDelayMin, config.safeDelayMax);
          await sleep(delay);

          await command.execute({
            api,
            message,
            args,
            threadId,
            threadType,
          });
        } else {
          // Lệnh không tồn tại (chỉ thông báo trong chat riêng hoặc khi chính mình test, tránh spam nhóm)
          if (!isGroup) {
            await api.sendMessage(
              {
                msg: `Lệnh '${config.prefix}${commandName}' không tồn tại. Gõ '${config.prefix}help' để xem danh sách lệnh.`,
                quote: message.data,
              },
              threadId,
              threadType
            );
          }
        }
        return;
      }

      // Bỏ qua tin nhắn thường do chính mình gửi (tránh bot tự trả lời AI với chính nó)
      if (isSelf) return;

      // Kiểm tra xem bot có được nhắc đến (tag @bot) hoặc trích dẫn trả lời (quote) trong nhóm không
      const botUid = api.listener?.ctx?.uid;
      const isMentioned = isGroup && Array.isArray(message.data?.mentions) && botUid && message.data.mentions.some(m => String(m.uid) === String(botUid));
      const isQuotingBot = isGroup && message.data?.quote && botUid && String(message.data.quote.ownerId) === String(botUid);

      // Điều kiện kích hoạt AI tự động:
      // 1. Trong nhóm: khi bot được tag (@bot) hoặc khi thành viên trích dẫn trả lời tin nhắn của bot
      // 2. Trong chat riêng 1-1: khi bật AUTO_REPLY_AI=true
      const shouldAutoTriggerAI =
        (isGroup && (isMentioned || isQuotingBot)) ||
        (!isGroup && config.autoReplyAi);

      if (shouldAutoTriggerAI && config.geminiApiKey) {
        const aiCmd = commands.get('ai');
        if (aiCmd) {
          logger.bot(`Tự động phản hồi AI cho [${senderName}] (Nhóm: ${isGroup ? 'Có' : 'Không'}, Tag: ${!!isMentioned}, Quote: ${!!isQuotingBot})`);
          const delay = getRandomDelay(config.safeDelayMin, config.safeDelayMax);
          await sleep(delay);

          // Nếu có tag trong tin nhắn, lọc bỏ phần tag để lấy nội dung câu hỏi sạch
          let cleanContent = rawContent;
          if (isMentioned) {
            cleanContent = cleanContent.replace(/@[^\s]+/g, '').trim();
          }

          await aiCmd.execute({
            api,
            message,
            args: cleanContent ? cleanContent.split(/\s+/) : [],
            threadId,
            threadType,
            isAutoReply: !isGroup && config.autoReplyAi && !isMentioned && !isQuotingBot,
          });
        }
      }
    } catch (err) {
      logger.error('Lỗi khi xử lý tin nhắn:', err.message || err);
    }
  });

  // 4. Bắt đầu lắng nghe
  logger.info('Đang kết nối WebSocket listener...');
  api.listener.start({ retryOnClose: true });
}

module.exports = {
  startBot,
};
