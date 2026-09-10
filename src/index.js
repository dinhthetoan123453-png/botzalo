const net = require('net');
const dns = require('dns');

// Ưu tiên IPv4 thay vì IPv6 để tránh lỗi fetch failed và WebSocket ETIMEDOUT trên Cloud (Render, Docker, Railway)
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

const http = require('http');
const fs = require('fs');
const config = require('./config');
const { authenticate } = require('./auth');
const { startBot } = require('./bot');
const logger = require('./utils/logger');

let server = null;

// Khởi động HTTP server nếu có PORT (dùng cho các dịch vụ đám mây như Render, Railway, Koyeb...)
if (process.env.PORT) {
  const PORT = process.env.PORT;
  server = http.createServer((req, res) => {
    const url = req.url || '/';

    // Endpoint kiểm tra trạng thái hoạt động (Health Check) cho Render / UptimeRobot
    if (url === '/health' || url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'ok', uptime: Math.floor(process.uptime()), message: 'Zalo Bot is running' }));
    }

    // 1. Xem trực tiếp file ảnh mã QR qua trình duyệt (ví dụ: /qr hoặc /qr.png)
    if (url === '/qr' || url.startsWith('/qr.png')) {
      if (fs.existsSync(config.qrPath)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return fs.createReadStream(config.qrPath).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<p>Mã QR chưa sẵn sàng hoặc bot đã đăng nhập thành công!</p><p><a href="/">Quay lại trang chủ</a></p>');
      }
    }

    // 2. Trang chủ hiển thị giao diện Dashboard và mã QR để quét bằng điện thoại
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      const hasQR = fs.existsSync(config.qrPath);
      let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zalo Bot Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 40px 15px; background: #f0f2f5; color: #1c1e21; margin: 0; }
    .card { max-width: 460px; margin: 0 auto; background: #ffffff; padding: 30px 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    h1 { color: #0068ff; font-size: 24px; margin-top: 0; margin-bottom: 12px; }
    .status { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 20px; }
    .status-ok { background: #e7f8ec; color: #0f8a3c; }
    .status-wait { background: #fff8e6; color: #b7791f; }
    .qr-container { margin: 20px 0; }
    .qr-img { width: 260px; height: 260px; border-radius: 12px; border: 3px solid #0068ff; box-shadow: 0 2px 10px rgba(0,104,255,0.15); }
    .note { font-size: 13px; color: #65676b; line-height: 1.5; margin-top: 15px; }
    .btn { display: inline-block; margin-top: 15px; padding: 8px 18px; background: #0068ff; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Zalo Bot Dashboard</h1>`;

      if (hasQR) {
        html += `
    <div class="status status-wait">Chờ quét mã QR đăng nhập</div>
    <p>Mở ứng dụng <strong>Zalo</strong> trên điện thoại &gt; Chọn <strong>Quét mã QR</strong> &gt; Quét hình bên dưới:</p>
    <div class="qr-container">
      <img class="qr-img" src="/qr.png?t=${Date.now()}" alt="Zalo QR Code" />
    </div>
    <p class="note">Mã QR có hạn sử dụng ngắn. Nếu mã hết hạn, hãy tải lại trang để lấy mã mới.</p>
    <a class="btn" href="javascript:location.reload()">Tải lại trang</a>`;
      } else {
        html += `
    <div class="status status-ok">Đang hoạt động trực tuyến</div>
    <p style="color: #0f8a3c; font-size: 16px; margin: 20px 0;">Bot đã kết nối thành công và đang lắng nghe tin nhắn!</p>
    <p class="note">Tiền tố lệnh: <code>${config.prefix}</code> (Ví dụ: <code>${config.prefix}help</code>, <code>${config.prefix}ping</code>)</p>`;
      }

      html += `
  </div>
</body>
</html>`;
      return res.end(html);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Máy chủ HTTP Health Check đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('       DỰ ÁN ZALO BOT TÀI KHOẢN CÁ NHÂN');
  console.log('='.repeat(50));
  console.log('LƯU Ý QUAN TRỌNG:');
  console.log('- Đây là thư viện mô phỏng Zalo Web không chính thức.');
  console.log('- Khuyến nghị nên sử dụng tài khoản phụ (nick test) để thử nghiệm.');
  console.log('- Không dùng bot để spam tin nhắn nhằm tránh checkpoint Zalo.');
  console.log('='.repeat(50) + '\n');

  try {
    const api = await authenticate();
    startBot(api);
  } catch (error) {
    const errMsg = error.message || String(error);
    logger.error('Khởi động Bot thất bại:', errMsg);

    if (errMsg.includes('Cannot get session') || errMsg.includes('login failed')) {
      console.log('\n' + '='.repeat(65));
      console.log('💡 HƯỚNG DẪN KHẮC PHỤC LỖI "Cannot get session, login failed":');
      console.log('1. Zalo chặn xác thực mã QR từ máy chủ Cloud/Render (IP Datacenter nước ngoài).');
      console.log('2. ĐỂ KHẮC PHỤC TRIỆT ĐỂ:');
      console.log('   - Chạy bot trên máy tính cá nhân (ở Việt Nam) bằng lệnh: npm start');
      console.log('   - Mở app Zalo quét mã QR trên màn hình để đăng nhập thành công.');
      console.log('   - Bot sẽ tự động in chuỗi "MÃ PHIÊN ZALO_SESSION MỚI" ra màn hình.');
      console.log('   - Sao chép toàn bộ chuỗi đó rồi dán vào biến môi trường ZALO_SESSION trên Render.');
      console.log('   - Render sẽ tự động khởi động lại và kết nối thành công 24/7!');
      console.log('='.repeat(65) + '\n');
    }

    process.exit(1);
  }
}

// Xử lý dừng bot an toàn khi bấm Ctrl + C
process.on('SIGINT', () => {
  console.log('\n');
  logger.info('Đang tắt Zalo Bot...');
  if (server) server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Tiến trình bot đã kết thúc.');
  if (server) server.close();
  process.exit(0);
});

main();
