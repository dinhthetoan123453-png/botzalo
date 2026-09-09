const fs = require('fs');
const path = require('path');
const play = require('play-dl');
const spotifyUrlInfo = require('spotify-url-info')(fetch);
const logger = require('./logger');

const TEMP_DIR = path.resolve(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

let soundCloudInitialized = false;

async function ensureSoundCloud() {
  if (!soundCloudInitialized) {
    try {
      const clientID = await play.getFreeClientID();
      await play.setToken({ soundcloud: { client_id: clientID } });
      soundCloudInitialized = true;
    } catch (err) {
      logger.error('Loi khoi tao SoundCloud client ID:', err.message);
    }
  }
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Khong ro';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Tim kiem bai hat tu Spotify hoac SoundCloud va tai ve file tam
 * @param {string} query - Tu khoa tim kiem hoac link Spotify / SoundCloud
 */
async function searchAndDownloadMusic(query) {
  await ensureSoundCloud();

  let trackTitle = '';
  let trackArtist = '';
  let coverUrl = '';
  let source = 'SoundCloud';
  let trackObj = null;

  // 1. Kiem tra xem co phai link Spotify khong
  const isSpotify = /open\.spotify\.com\/track\/|spotify:track:/i.test(query);

  if (isSpotify) {
    try {
      source = 'Spotify';
      const preview = await spotifyUrlInfo.getPreview(query);
      trackTitle = preview.title || preview.track || 'Unknown';
      trackArtist = preview.artist || 'Unknown';
      coverUrl = preview.image || '';

      // Tim ban audio tuong ung tren SoundCloud
      const scSearch = await play.search(`${trackArtist} - ${trackTitle}`, {
        source: { soundcloud: 'tracks' },
        limit: 1,
      });

      if (scSearch && scSearch.length > 0) {
        trackObj = scSearch[0];
      }
    } catch (spErr) {
      logger.warn('Loi khi doc thong tin Spotify:', spErr.message);
    }
  }

  // 2. Neu khong phai Spotify hoac la tim kiem SoundCloud thong thuong
  if (!trackObj) {
    try {
      const searchResults = await play.search(query, {
        source: { soundcloud: 'tracks' },
        limit: 1,
      });

      if (searchResults && searchResults.length > 0) {
        trackObj = searchResults[0];
        trackTitle = trackObj.name || query;
        trackArtist = trackObj.user?.name || 'Nghe si';
        if (!coverUrl && trackObj.thumbnail) {
          coverUrl = trackObj.thumbnail.replace('-large.jpg', '-t500x500.jpg');
        }
      }
    } catch (scErr) {
      logger.error('Loi khi tim kiem tren SoundCloud:', scErr.message);
    }
  }

  if (!trackObj) {
    return null;
  }

  const timestamp = Date.now();
  const imagePath = path.join(TEMP_DIR, `cover_${timestamp}.jpg`);
  const audioPath = path.join(TEMP_DIR, `audio_${timestamp}.mp3`);

  // Tai anh bia
  let hasImage = false;
  if (coverUrl) {
    try {
      const imgRes = await fetch(coverUrl);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(imagePath, buffer);
        hasImage = true;
      }
    } catch (imgErr) {
      logger.warn('Khong the tai anh bia bai hat:', imgErr.message);
    }
  }

  // Tai audio stream
  const streamInfo = await play.stream_from_info(trackObj);
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(audioPath);
    streamInfo.stream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return {
    title: trackTitle,
    artist: trackArtist,
    source,
    duration: formatDuration(trackObj.durationInSec),
    imagePath: hasImage ? imagePath : null,
    audioPath,
    cleanup: () => {
      try {
        if (hasImage && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch (_) {}
    },
  };
}

module.exports = {
  searchAndDownloadMusic,
};
