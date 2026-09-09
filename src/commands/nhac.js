const musicCommand = require('./music');

module.exports = {
  name: 'nhac',
  description: 'Tìm kiếm và gửi nhạc từ SoundCloud hoặc link Spotify kèm ảnh bìa (viết tắt của !music)',
  usage: '!nhac <tên bài hát hoặc link>',
  async execute(params) {
    return musicCommand.execute(params);
  },
};
