const { downloadTikTokVideo, extractTikTokUrl } = require('../utils/tiktokHelper');
const logger = require('../utils/logger');

module.exports = {
  name: 'stik',
  description: 'Tải video TikTok không logo kèm thông tin chi tiết',
  usage: '!stik <link video tiktok>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: 'Vui lòng nhập link video TikTok cần tải.\n\nVí dụ:\n!stik https://vt.tiktok.com/ZSjR1p5kF/\n!stik https://www.tiktok.com/@tiktok/video/7106594312292453675',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    const input = args.join(' ');
    const tiktokUrl = extractTikTokUrl(input);

    if (!tiktokUrl) {
      await api.sendMessage(
        {
          msg: 'Không tìm thấy liên kết TikTok hợp lệ trong tin nhắn của bạn. Vui lòng kiểm tra lại link.',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    // Gửi thông báo đang xử lý
    await api.sendMessage(
      {
        msg: 'Đang tải và xử lý video TikTok không logo, vui lòng đợi trong giây lát...',
        quote: message.data,
      },
      threadId,
      threadType
    );

    let result = null;
    try {
      result = await downloadTikTokVideo(tiktokUrl);

      if (!result) {
        await api.sendMessage(
          {
            msg: 'Không thể xử lý video TikTok này. Vui lòng thử lại sau.',
            quote: message.data,
          },
          threadId,
          threadType
        );
        return;
      }

      logger.info(`Đã xử lý xong video TikTok: "${result.title}" của [${result.author}]`);

      // 1. Gửi thông tin chi tiết của video (kèm ảnh bìa nếu có)
      const infoMsg = `🎬 [THÔNG TIN VIDEO TIKTOK]\n` +
        `👤 Tác giả: ${result.author}\n` +
        `📝 Tiêu đề: ${result.title}\n` +
        `⏱️ Thời lượng: ${result.duration}\n` +
        `🎵 Âm nhạc: ${result.music}\n` +
        `📊 Tương tác: ❤️ ${result.likes} | 💬 ${result.comments} | 👁️ ${result.views}`;

      if (result.coverPath) {
        await api.sendMessage(
          {
            msg: infoMsg,
            attachments: [result.coverPath],
            quote: message.data,
          },
          threadId,
          threadType
        );
      } else {
        await api.sendMessage(
          {
            msg: infoMsg,
            quote: message.data,
          },
          threadId,
          threadType
        );
      }

      // 2. Gửi file video MP4 không dán logo
      if (result.videoPath) {
        logger.info(`Đang tải lên video TikTok: ${result.videoPath}`);
        const caption = `Video: ${result.title.slice(0, 100)}`;
        await api.sendMessage(
          {
            msg: caption,
            attachments: [result.videoPath],
          },
          threadId,
          threadType
        );
      }
    } catch (err) {
      logger.error('Lỗi khi xử lý lệnh tải TikTok:', err.message || err);
      await api.sendMessage(
        {
          msg: `Có lỗi xảy ra khi tải video TikTok: ${err.message || 'Lỗi không xác định'}`,
          quote: message.data,
        },
        threadId,
        threadType
      );
    } finally {
      if (result && typeof result.cleanup === 'function') {
        result.cleanup();
      }
    }
  },
};
