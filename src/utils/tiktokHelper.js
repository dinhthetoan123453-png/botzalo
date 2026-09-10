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
 * Trích xuất liên kết TikTok từ đoạn văn bản
 */
function extractTikTokUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/https?:\/\/(?:www\.|vt\.|vm\.|m\.)?tiktok\.com\/[^\s]+/i);
  return match ? match[0] : null;
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
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Máy chủ dịch vụ TikTok trả về lỗi mạng (${res.status} ${res.statusText})`);
  }

  const data = await res.json();
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || 'Không thể tìm thấy hoặc xử lý video TikTok này. Có thể video bị riêng tư hoặc đã bị xóa.');
  }

  const vData = data.data;
  const videoUrl = vData.play || vData.hdplay || vData.wmplay;
  if (!videoUrl) {
    throw new Error('Không tìm thấy luồng video có thể tải về.');
  }

  const timestamp = Date.now();
  const videoPath = path.join(TEMP_DIR, `tiktok_${timestamp}.mp4`);
  const coverPath = path.join(TEMP_DIR, `tiktok_cover_${timestamp}.jpg`);

  // Tải ảnh bìa nếu có
  let hasCover = false;
  if (vData.cover) {
    try {
      const coverRes = await fetch(vData.cover);
      if (coverRes.ok) {
        const coverBuf = Buffer.from(await coverRes.arrayBuffer());
        fs.writeFileSync(coverPath, coverBuf);
        hasCover = true;
      }
    } catch (err) {
      logger.warn('Không thể tải ảnh bìa TikTok:', err.message);
    }
  }

  // Tải video MP4 không logo
  logger.info(`Đang tải file video TikTok: ${videoUrl}`);
  const vRes = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.tiktok.com/',
    },
  });

  if (!vRes.ok) {
    throw new Error(`Không thể tải tệp video từ CDN (${vRes.status} ${vRes.statusText})`);
  }

  const videoBuffer = Buffer.from(await vRes.arrayBuffer());
  fs.writeFileSync(videoPath, videoBuffer);
  logger.success(`Đã tải xong video TikTok (${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

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
    videoPath,
    coverPath: hasCover ? coverPath : null,
    cleanup: () => {
      try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (hasCover && fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      } catch (_) {}
    },
  };
}

module.exports = {
  extractTikTokUrl,
  downloadTikTokVideo,
};
