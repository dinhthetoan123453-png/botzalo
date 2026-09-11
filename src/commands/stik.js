const { downloadTikTokVideo, extractTikTokUrl } = require('../utils/tiktokHelper');
const { safeSendMessage } = require('../utils/messageHelper');
const logger = require('../utils/logger');

module.exports = {
  name: 'stik',
  aliases: ['tik', 'tiktok', 'tt'],
  description: 'Tải video TikTok không logo kèm thông tin chi tiết',
  usage: '!stik <link video tiktok>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await safeSendMessage(
        api,
        {
          msg: '📌 Vui lòng nhập liên kết video TikTok cần tải.\n\nVí dụ:\n!stik https://vt.tiktok.com/ZSqUturPA/\n!stik https://www.tiktok.com/@tiktok/video/7106594312292453675',
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
      await safeSendMessage(
        api,
        {
          msg: '❌ Không tìm thấy liên kết TikTok hợp lệ trong tin nhắn của bạn. Vui lòng kiểm tra lại liên kết.',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    let result = null;
    try {
      // Gửi thông báo bắt đầu xử lý
      await safeSendMessage(
        api,
        {
          msg: '⏳ Đang tải và xử lý video TikTok không logo, vui lòng đợi trong giây lát...',
          quote: message.data,
        },
        threadId,
        threadType
      );

      result = await downloadTikTokVideo(tiktokUrl);

      if (!result) {
        await safeSendMessage(
          api,
          {
            msg: '❌ Không thể xử lý video TikTok này. Vui lòng thử lại sau.',
            quote: message.data,
          },
          threadId,
          threadType
        );
        return;
      }

      logger.info(`Đã xử lý xong thông tin video TikTok: "${result.title}" của [${result.author}]`);

      // 1. Gửi thông tin chi tiết của video (kèm ảnh bìa và link tải trực tiếp không logo)
      const infoMsg = `🎬 [THÔNG TIN VIDEO TIKTOK]\n` +
        `👤 Tác giả: ${result.author}\n` +
        `📝 Tiêu đề: ${result.title}\n` +
        `⏱️ Thời lượng: ${result.duration}\n` +
        `🎵 Âm nhạc: ${result.music}\n` +
        `📊 Tương tác: ❤️ ${result.likes} | 💬 ${result.comments} | 👁️ ${result.views}\n` +
        `🔗 Link tải trực tiếp không logo:\n${result.downloadUrl}`;

      let infoSent = false;
      if (result.coverPath) {
        try {
          await safeSendMessage(
            api,
            {
              msg: infoMsg,
              attachments: [result.coverPath],
              quote: message.data,
            },
            threadId,
            threadType
          );
          infoSent = true;
        } catch (coverErr) {
          logger.warn('Không thể gửi kèm ảnh bìa, chuyển sang gửi dạng text:', coverErr.message || coverErr);
        }
      }

      if (!infoSent) {
        await safeSendMessage(
          api,
          {
            msg: infoMsg,
            quote: message.data,
          },
          threadId,
          threadType
        );
      }

      // 2. Gửi video lên đoạn chat Zalo
      let videoSent = false;
      const caption = `🎥 Video: ${result.title.slice(0, 100)}`;

      // Ưu tiên 1: Gửi qua api.sendVideo (Zalo Video Player - xem và phát trực tiếp ngay trong đoạn chat Zalo)
      if (typeof api.sendVideo === 'function' && result.downloadUrl) {
        try {
          logger.info(`Đang gửi video TikTok trực tiếp qua api.sendVideo...`);
          await api.sendVideo(
            {
              videoUrl: result.downloadUrl,
              thumbnailUrl: result.coverUrl || '',
              duration: result.durationSec || 0,
              width: result.width || 720,
              height: result.height || 1280,
              msg: caption,
            },
            threadId,
            threadType
          );
          videoSent = true;
          logger.success('Đã gửi video TikTok qua api.sendVideo thành công!');
        } catch (videoErr) {
          logger.warn('Gửi qua api.sendVideo thất bại, chuyển sang gửi tệp đính kèm:', videoErr.message || videoErr);
        }
      }

      // Ưu tiên 2: Nếu sendVideo chưa gửi được và có tệp video MP4 tải về, thử gửi dạng file đính kèm
      if (!videoSent && result.videoPath) {
        try {
          logger.info(`Đang tải tệp video TikTok lên đoạn chat Zalo: ${result.videoPath}`);
          await safeSendMessage(
            api,
            {
              msg: caption,
              attachments: [result.videoPath],
            },
            threadId,
            threadType
          );
          videoSent = true;
          logger.success('Đã gửi tệp video TikTok lên Zalo thành công!');
        } catch (uploadErr) {
          logger.warn('Không thể gửi trực tiếp tệp video qua Zalo:', uploadErr.message || uploadErr);
        }
      }

      // Nếu cả hai phương thức gửi video đều không thành công, thông báo để người dùng bấm vào link trực tiếp
      if (!videoSent) {
        await safeSendMessage(
          api,
          {
            msg: `⚠️ Zalo không hỗ trợ hiển thị tệp video này trực tiếp trong phiên bản Web hiện tại.\n👉 Bạn hãy bấm vào liên kết ở tin nhắn thông tin bên trên để xem trực tiếp hoặc tải video về máy nhé!`,
          },
          threadId,
          threadType
        );
      }
    } catch (err) {
      logger.error('Lỗi khi xử lý lệnh tải TikTok:', err.message || err);
      await safeSendMessage(
        api,
        {
          msg: `❌ Có lỗi xảy ra khi xử lý video TikTok: ${err.message || 'Lỗi không xác định'}\nVui lòng kiểm tra lại liên kết video.`,
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
