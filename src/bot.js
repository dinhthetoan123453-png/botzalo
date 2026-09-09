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
  // 1. Tải toàn bộ danh sách lệnh
  loadCommands();

  // 2. Lắng nghe các sự kiện kết nối của listener
  api.listener.on('connected', () => {
    logger.success('🚀 WebSocket đã kết nối tới máy chủ Zalo!');
    logger.bot(`Bot đang lắng nghe tin nhắn với tiền tố: [ ${config.prefix} ]`);
  });

  api.listener.on('disconnected', (code, reason) => {
    logger.warn(`⚠️ Mất kết nối tới máy chủ Zalo (Mã: ${code}, Lý do: ${reason || 'Không rõ'})`);
  });

  api.listener.on('closed', (code, reason) => {
    logger.warn(`⚠️ WebSocket đã đóng (Mã: ${code}, Lý do: ${reason || 'Không rõ'}). Chú ý: Nếu bạn mở Zalo trên trình duyệt cùng lúc, kết nối bot sẽ tự động ngắt.`);
  });

  api.listener.on('error', (err) => {
    logger.error('Lỗi WebSocket listener:', err);
  });

  // 3. Xử lý tin nhắn đến
  api.listener.on('message', async (message) => {
    try {
      // Bỏ qua tin nhắn do chính tài khoản bot gửi (tránh lặp vô tận)
      if (message.isSelf) return;

      // Chỉ xử lý tin nhắn dạng văn bản
      if (typeof message.data?.content !== 'string') return;

      const rawContent = message.data.content.trim();
      const senderName = message.data.dName || 'Ai đó';
      const threadId = message.threadId;
      const threadType = message.type;
      const isGroup = threadType === ThreadType.Group;

      logger.msg(`[${isGroup ? 'Nhóm' : 'Riêng'}] ${senderName}: ${rawContent}`);

      // Kiểm tra xem tin nhắn có bắt đầu bằng tiền tố lệnh không
      if (rawContent.startsWith(config.prefix)) {
        const fullCommand = rawContent.slice(config.prefix.length).trim();
        const args = fullCommand.split(/\s+/);
        const commandName = args.shift().toLowerCase();

        const command = commands.get(commandName);
        if (command) {
          logger.bot(`Thực thi lệnh '${commandName}' từ người dùng [${senderName}]`);

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
          // Lệnh không tồn tại (tuỳ chọn bỏ qua để không làm phiền nhóm)
          if (!isGroup) {
            await api.sendMessage(
              {
                msg: `❓ Lệnh '${config.prefix}${commandName}' không tồn tại. Gõ '${config.prefix}help' để xem danh sách lệnh có sẵn.`,
                quote: message.data,
              },
              threadId,
              threadType
            );
          }
        }
        return;
      }

      // Xử lý tự động trả lời bằng AI nếu bật AUTO_REPLY_AI và có cấu hình Gemini API Key
      if (config.autoReplyAi && config.geminiApiKey) {
        // Nếu là nhóm chat thì chỉ trả lời nếu được nhắc tới hoặc tin riêng
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
      logger.error('Lỗi khi xử lý tin nhắn:', err);
    }
  });

  // 4. Bắt đầu lắng nghe
  logger.info('Đang kết nối WebSocket listener...');
  api.listener.start({ retryOnClose: true });
}

module.exports = {
  startBot,
};
