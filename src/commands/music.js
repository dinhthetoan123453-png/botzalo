const { searchAndDownloadMusic } = require('../utils/musicHelper');
const logger = require('../utils/logger');

module.exports = {
  name: 'music',
  description: 'Tim kiem va gui nhac tu SoundCloud hoac link Spotify kem anh bia',
  usage: '!music <ten bai hat hoac link>',
  async execute({ api, message, args, threadId, threadType }) {
    if (!args || args.length === 0) {
      await api.sendMessage(
        {
          msg: 'Vui long nhap ten bai hat hoac link Spotify / SoundCloud. Vi du: !music Chung ta cua tuong lai',
          quote: message.data,
        },
        threadId,
        threadType
      );
      return;
    }

    const query = args.join(' ');

    // Thong bao dang xu ly
    await api.sendMessage(
      {
        msg: `Dang tim kiem va xu ly bai hat: "${query}". Vui long doi giay lat...`,
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
            msg: `Khong tim thay bai hat nao voi tu khoa: "${query}".`,
            quote: message.data,
          },
          threadId,
          threadType
        );
        return;
      }

      logger.info(`Tim thay bai hat: ${result.title} - ${result.artist}`);

      // 1. Gui anh bia kem thong tin bai hat
      const infoMsg = `[THONG TIN BAI HAT]\n` +
        `- Ten: ${result.title}\n` +
        `- Nghe si: ${result.artist}\n` +
        `- Nguon: ${result.source}\n` +
        `- Thoi luong: ${result.duration}`;

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

      // 2. Gui file am thanh (audio mp3)
      if (result.audioPath) {
        logger.info(`Dang tai len file audio: ${result.audioPath}`);
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
      logger.error('Loi khi tim hoac gui nhac:', err.message || err);
      await api.sendMessage(
        {
          msg: `Co loi xay ra khi tai bai hat: ${err.message || 'Loi khong xac dinh'}`,
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
