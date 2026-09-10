const net = require('net');
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

const { ThreadType } = require('zca-js');
const config = require('./config');
const logger = require('./utils/logger');
const chatHistory = require('./utils/chatHistory');
const { commands, loadCommands } = require('./commands');
const { applyZcaPatches } = require('./utils/patchZca');
const { extractTikTokUrl } = require('./utils/tiktokHelper');

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
 * Kiểm tra xem tin nhắn có phải là thông báo hoặc phản hồi hệ thống tự động của bot không,
 * nhằm loại bỏ khỏi chatHistory để tránh làm ô nhiễm ngữ cảnh AI.
 */
function isBotSystemMessage(content) {
  if (!content || typeof content !== 'string') return false;
  const text = content.trim();
  return text.startsWith('Pong!') ||
         text.startsWith('Echo:') ||
         text.startsWith('[THÔNG TIN BÀI HÁT]') ||
         text.startsWith('🎬 [THÔNG TIN VIDEO TIKTOK]') ||
         text.startsWith('⏳ Đang tải và xử lý video TikTok') ||
         text.startsWith('🎥 Video:') ||
         text.startsWith('⚠️ Không thể gửi tệp video') ||
         text.startsWith('❌ ') ||
         text.startsWith('📌 ') ||
         text.startsWith('Audio:') ||
         text.startsWith('Video:') ||
         text.startsWith('Đang tìm kiếm') ||
         text.startsWith('Đang tải') ||
         text.startsWith('DANH SÁCH LỆNH') ||
         text.startsWith('THÔNG TIN CUỘC TRÒ CHUYỆN:') ||
         text.startsWith("Lệnh '") ||
         text.startsWith('Lỗi ') ||
         text.startsWith('📋 [LỊCH SỬ') ||
         text.startsWith('Tính năng AI') ||
         text.startsWith('Vui lòng nhập') ||
         text.startsWith('Không tìm thấy');
}

/**
 * Khởi động lắng nghe tin nhắn và xử lý lệnh
 * @param {import('zca-js').API} api
 */
function startBot(api) {
  // Áp dụng bản vá sửa lỗi treo uploadAttachment (video & file nhiều chunk) trong thư viện zca-js
  applyZcaPatches(api);

  // Bọc api.sendMessage để tự động thử lại khi tính năng quote (trích dẫn) bị lỗi ở một số hội thoại (ví dụ Cloud của tôi)
  const originalSendMessage = api.sendMessage.bind(api);
  api.sendMessage = async function (content, threadId, threadType) {
    try {
      return await originalSendMessage(content, threadId, threadType);
    } catch (err) {
      if (typeof content === 'object' && content && content.quote) {
        logger.warn(`Không thể gửi tin nhắn dạng trích dẫn (${err.message}). Đang chuyển sang gửi tin nhắn thường...`);
        const fallbackContent = { ...content };
        delete fallbackContent.quote;
        return await originalSendMessage(fallbackContent, threadId, threadType);
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

  // Cho phép listener tự động thử lại khi gặp mã đóng 1006 (Abnormal closure do mạng)
  try {
    const socketSettings = api.listener?.ctx?.settings?.features?.socket;
    if (socketSettings) {
      if (Array.isArray(socketSettings.close_and_retry_codes) && !socketSettings.close_and_retry_codes.includes(1006)) {
        socketSettings.close_and_retry_codes.push(1006);
      }
      if (socketSettings.retries && !socketSettings.retries['1006']) {
        socketSettings.retries['1006'] = {
          max: 10,
          times: [1000, 2000, 3000, 5000],
        };
      }
    }
  } catch (_) {}

  api.listener.on('disconnected', (code, reason) => {
    logger.warn(`Mất kết nối tới máy chủ Zalo (Mã: ${code}, Lý do: ${reason || 'Không rõ'})`);
  });

  api.listener.on('closed', (code, reason) => {
    logger.warn(`WebSocket đã đóng (Mã: ${code}, Lý do: ${reason || 'Không rõ'}). Chú ý: Nếu bạn mở Zalo trên trình duyệt cùng lúc, kết nối bot sẽ tự động ngắt.`);
    if (code === 1006) {
      logger.info('Phát hiện kết nối mạng bị gián đoạn (Mã 1006). Đang tự động kết nối lại sau 3 giây...');
      setTimeout(() => {
        try {
          api.listener.start({ retryOnClose: true });
        } catch (err) {
          logger.warn(`Thử kết nối lại WebSocket thất bại: ${err.message}`);
        }
      }, 3000);
    }
  });

  api.listener.on('error', (err) => {
    logger.error('Lỗi WebSocket listener:', err.message || err);
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

      // Kiểm tra xem tin nhắn có bắt đầu bằng tiền tố lệnh không (hỗ trợ cả config.prefix, / và !)
      let prefixUsed = null;
      if (rawContent.startsWith(config.prefix)) {
        prefixUsed = config.prefix;
      } else if (rawContent.startsWith('/')) {
        prefixUsed = '/';
      } else if (rawContent.startsWith('!')) {
        prefixUsed = '!';
      }

      const isCommand = Boolean(prefixUsed);
      if (!isCommand && !isBotSystemMessage(rawContent)) {
        chatHistory.addMessage(threadId, {
          sender: isSelf ? 'Bot (Bạn)' : senderName,
          content: rawContent,
          isSelf,
          timestamp: Number(message.data?.ts) || Date.now(),
        });
      }

      // Kiểm tra xem tin nhắn có bắt đầu bằng tiền tố lệnh không (ví dụ: !stik, /stik, !ping, /ping)
      if (isCommand) {
        const fullCommand = rawContent.slice(prefixUsed.length).trim();
        if (!fullCommand) return; // Bỏ qua nếu người dùng chỉ nhắn mỗi ký tự tiền tố lệnh ! hoặc /

        const args = fullCommand.split(/\s+/);
        const commandName = args.shift().toLowerCase();
        if (!commandName) return;

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
                msg: `Lệnh '${prefixUsed}${commandName}' không tồn tại. Gõ '${prefixUsed}help' để xem danh sách lệnh.`,
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

      // Kiểm tra xem người dùng có gửi liên kết TikTok trực tiếp không (tiện lợi khi quên gõ lệnh !stik)
      const directTikTokUrl = extractTikTokUrl(rawContent);
      if (directTikTokUrl && (!isGroup || isMentioned || isQuotingBot)) {
        const stikCmd = commands.get('stik');
        if (stikCmd) {
          logger.bot(`Tự động kích hoạt tải video TikTok từ liên kết của [${senderName}]`);
          const delay = getRandomDelay(config.safeDelayMin, config.safeDelayMax);
          await sleep(delay);
          await stikCmd.execute({
            api,
            message,
            args: [directTikTokUrl],
            threadId,
            threadType,
          });
          return;
        }
      }

      // Kiểm tra xem bot có được nhắc đến (tag @bot) hoặc trích dẫn trả lời (quote) trong nhóm không
      const botUid = (typeof api.getOwnId === 'function' ? api.getOwnId() : api.listener?.ctx?.uid);
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
