const { ThreadType } = require('zca-js');
const config = require('./config');
const logger = require('./utils/logger');
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
    logger.success('WebSocket da ket noi toi may chu Zalo!');
    logger.bot(`Bot dang lang nghe tin nhan voi tien to: [ ${config.prefix} ]`);
  });

  api.listener.on('disconnected', (code, reason) => {
    logger.warn(`Mat ket noi toi may chu Zalo (Ma: ${code}, Ly do: ${reason || 'Khong ro'})`);
  });

  api.listener.on('closed', (code, reason) => {
    logger.warn(`WebSocket da dong (Ma: ${code}, Ly do: ${reason || 'Khong ro'}). Chu y: Neu ban mo Zalo tren trinh duyet cung luc, ket noi bot se tu dong ngat.`);
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

      // Kiểm tra xem tin nhắn có bắt đầu bằng tiền tố lệnh không (ví dụ: !ping, !help)
      if (rawContent.startsWith(config.prefix)) {
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
                msg: `Lenh '${config.prefix}${commandName}' khong ton tai. Go '${config.prefix}help' de xem danh sach lenh.`,
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

      // Xử lý tự động trả lời bằng AI nếu bật AUTO_REPLY_AI và có cấu hình Gemini API Key
      if (config.autoReplyAi && config.geminiApiKey) {
        // Chỉ tự động trả lời trong tin nhắn riêng 1-1
        if (!isGroup) {
          const aiCmd = commands.get('ai');
          if (aiCmd) {
            const delay = getRandomDelay(config.safeDelayMin, config.safeDelayMax);
            await sleep(delay);

            await aiCmd.execute({
              api,
              message,
              args: rawContent.split(/\s+/),
              threadId,
              threadType,
            });
          }
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
