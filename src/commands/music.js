const { searchAndDownloadMusic } = require('../utils/musicHelper');
const logger = require('../utils/logger');

module.exports = {
  name: 'music',
  description: 'Tìm kiếm và gửi nhạc từ SoundCloud hoặc link Spotify kèm ảnh bìa',
  usage: '!music <tên bài hát hoặc link>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: 'Vui lòng nhập tên bài hát hoặc link Spotify / SoundCloud. Ví dụ: !music Chúng ta của tương lai',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    const query = args.join(' ');

    // Thông báo đang xử lý
    await api.sendMessage(
      {
        msg: `Đang tìm kiếm và xử lý bài hát: "${query}". Vui lòng đợi giây lát...`,
        quote: message.data,
      },
      threadId,
      threadType
    );

    let result = null;
    try {
      result = await searchAndDownloadMusic(query);

      if (!result) {
        await api.sendMessage(
          {
            msg: `Không tìm thấy bài hát nào với từ khóa: "${query}".`,
            quote: message.data,
          },
          threadId,
          threadType
        );
        return;
      }

      logger.info(`Tìm thấy bài hát: ${result.title} - ${result.artist}`);

      // 1. Gửi ảnh bìa kèm thông tin bài hát
      const infoMsg = `[THÔNG TIN BÀI HÁT]\n` +
        `- Tên: ${result.title}\n` +
        `- Nghệ sĩ: ${result.artist}\n` +
        `- Nguồn: ${result.source}\n` +
        `- Thời lượng: ${result.duration}`;

      if (result.imagePath) {
        await api.sendMessage(
          {
            msg: infoMsg,
            attachments: [result.imagePath],
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

      // 2. Gửi file âm thanh (audio mp3)
      if (result.audioPath) {
        logger.info(`Đang tải lên file audio: ${result.audioPath}`);
        await api.sendMessage(
          {
            msg: `Audio: ${result.title}.mp3`,
            attachments: [result.audioPath],
          },
          threadId,
          threadType
        );
      }
    } catch (err) {
      logger.error('Lỗi khi tìm hoặc gửi nhạc:', err.message || err);
      await api.sendMessage(
        {
          msg: `Có lỗi xảy ra khi tải bài hát: ${err.message || 'Lỗi không xác định'}`,
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
