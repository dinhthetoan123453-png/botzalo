const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const TEMP_DIR = path.resolve(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Định dạng số thành chuỗi dễ đọc (ví dụ: 12500 -> 12.5K, 1500000 -> 1.5M)
 */
function formatNumber(num) {
  if (!num || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString('vi-VN');
}

/**
 * Định dạng thời lượng giây sang mm:ss
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Không rõ';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Trích xuất liên kết TikTok/Douyin từ đoạn văn bản (hỗ trợ mọi định dạng: vt, vm, v, vn, m, www... và có hoặc không có https://)
 */
function extractTikTokUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:tiktok\.com|douyin\.com)\/[^\s]+/i);
  if (match) {
    let url = match[0].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }
  return null;
}

/**
 * Tải video TikTok không dán logo và trích xuất thông tin chi tiết
 * @param {string} inputUrl - Liên kết video TikTok
 */
async function downloadTikTokVideo(inputUrl) {
  const targetUrl = extractTikTokUrl(inputUrl) || inputUrl.trim();
  if (!targetUrl) {
    throw new Error('Không tìm thấy liên kết TikTok hợp lệ.');
  }

  logger.info(`Đang gọi API trích xuất video TikTok: ${targetUrl}`);

  const endpoints = [
    `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`,
    `https://tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`,
  ];

  let vData = null;
  let lastError = null;

  for (const apiUrl of endpoints) {
    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!res.ok) {
        throw new Error(`Máy chủ TikTok API trả về mã lỗi HTTP ${res.status} (${res.statusText})`);
      }

      const json = await res.json();
      if (json.code === 0 && json.data) {
        vData = json.data;
        break;
      } else if (json.msg) {
        lastError = new Error(json.msg);
      }
    } catch (err) {
      lastError = err;
      logger.warn(`Thử kết nối endpoint ${apiUrl} thất bại: ${err.message}`);
    }
  }

  if (!vData) {
    throw (lastError || new Error('Không thể tìm thấy hoặc xử lý video TikTok này. Có thể video ở chế độ riêng tư hoặc đã bị xóa.'));
  }

  let videoUrl = vData.play || vData.hdplay || vData.wmplay;
  if (!videoUrl) {
    throw new Error('Không tìm thấy liên kết tệp video có thể phát.');
  }
  if (videoUrl.startsWith('/')) {
    videoUrl = 'https://www.tikwm.com' + videoUrl;
  }

  const timestamp = Date.now();
  const videoPath = path.join(TEMP_DIR, `tiktok_${timestamp}.mp4`);
  const coverPath = path.join(TEMP_DIR, `tiktok_cover_${timestamp}.jpg`);

  // Tải ảnh bìa nếu có (timeout 10s)
  let hasCover = false;
  if (vData.cover) {
    try {
      let coverUrl = vData.cover;
      if (coverUrl.startsWith('/')) {
        coverUrl = 'https://www.tikwm.com' + coverUrl;
      }
      const coverRes = await fetch(coverUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (coverRes.ok) {
        const coverBuf = Buffer.from(await coverRes.arrayBuffer());
        fs.writeFileSync(coverPath, coverBuf);
        hasCover = true;
      }
    } catch (err) {
      logger.warn('Không thể tải ảnh bìa TikTok:', err.message);
    }
  }

  // Tải video MP4 không logo về bộ nhớ tạm (timeout 30s)
  let hasVideo = false;
  logger.info(`Đang tải file video TikTok: ${videoUrl}`);
  try {
    const vRes = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (vRes.ok) {
      const videoBuffer = Buffer.from(await vRes.arrayBuffer());
      fs.writeFileSync(videoPath, videoBuffer);
      hasVideo = true;
      logger.success(`Đã tải xong video TikTok (${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    } else {
      logger.warn(`Không thể tải tệp video từ CDN (HTTP ${vRes.status})`);
    }
  } catch (err) {
    logger.warn('Không thể tải tệp video MP4 về bộ nhớ tạm:', err.message);
  }

  const authorName = vData.author?.nickname || 'Người dùng TikTok';
  const authorUsername = vData.author?.unique_id ? `@${vData.author.unique_id}` : '';
  const musicTitle = vData.music_info?.title || vData.music || 'Âm thanh gốc';
  const musicAuthor = vData.music_info?.author ? ` - ${vData.music_info.author}` : '';

  return {
    title: vData.title || 'Video TikTok không có tiêu đề',
    author: authorUsername ? `${authorName} (${authorUsername})` : authorName,
    duration: formatDuration(vData.duration),
    likes: formatNumber(vData.digg_count),
    comments: formatNumber(vData.comment_count),
    shares: formatNumber(vData.share_count),
    views: formatNumber(vData.play_count),
    music: `${musicTitle}${musicAuthor}`,
    downloadUrl: videoUrl,
    videoPath: hasVideo ? videoPath : null,
    coverPath: hasCover ? coverPath : null,
    cleanup: () => {
      try {
        if (hasVideo && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (hasCover && fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      } catch (_) {}
    },
  };
}

module.exports = {
  extractTikTokUrl,
  downloadTikTokVideo,
};
