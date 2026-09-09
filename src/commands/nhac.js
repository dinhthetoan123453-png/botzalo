const musicCommand = require('./music');

module.exports = {
  name: 'nhac',
  description: 'Tim kiem va gui nhac tu SoundCloud hoac link Spotify kem anh bia (viet tat cua !music)',
  usage: '!nhac <ten bai hat hoac link>',
  async execute(params) {
    return musicCommand.execute(params);
  },
};
