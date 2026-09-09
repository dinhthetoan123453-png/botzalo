const { authenticate } = require('./auth');
const { startBot } = require('./bot');
const logger = require('./utils/logger');

async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('       🤖 DỰ ÁN ZALO BOT TÀI KHOẢN CÁ NHÂN');
  console.log('='.repeat(50));
  console.log('⚠️  LƯU Ý QUAN TRỌNG:');
  console.log('- Đây là thư viện mô phỏng Zalo Web không chính thức.');
  console.log('- Khuyến nghị nên sử dụng tài khoản phụ (nick test) để thử nghiệm.');
  console.log('- Không dùng bot để spam tin nhắn nhằm tránh checkpoint Zalo.');
  console.log('='.repeat(50) + '\n');

  try {
    const api = await authenticate();
    startBot(api);
  } catch (error) {
    logger.error('Khởi động Bot thất bại:', error.message || error);
    process.exit(1);
  }
}

// Xử lý dừng bot an toàn khi bấm Ctrl + C
process.on('SIGINT', () => {
  console.log('\n');
  logger.info('Đang tắt Zalo Bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Tiến trình bot đã kết thúc.');
  process.exit(0);
});

main();
