# Zalo Personal Account Bot (Dự án Bot Zalo Tài Khoản Cá Nhân)

Dự án Zalo Bot chạy trực tiếp trên tài khoản Zalo cá nhân (Userbot) được xây dựng bằng Node.js và thư viện zca-js. Dự án hỗ trợ đăng nhập qua mã QR, tự động lưu session, phân nhánh lệnh dạng module, tìm và gửi nhạc từ SoundCloud/Spotify kèm ảnh bìa, và tích hợp AI (Google Gemini).

---

## Lưu ý về an toàn tài khoản

- Zalo chưa hỗ trợ API mở cho tài khoản cá nhân. Thư viện hoạt động bằng cách mô phỏng giao thức Zalo Web.
- Khuyến nghị sử dụng tài khoản phụ (nick test) để chạy thử nghiệm.
- Không dùng bot để gửi tin nhắn spam hoặc gửi tin với tần suất quá cao để tránh bị khóa tài khoản.
- File session.json chứa thông tin cookie đăng nhập, tuyệt đối không chia sẻ hoặc commit file này lên GitHub.

---

## Cấu trúc thư mục

```text
zalo bot/
├── src/
│   ├── commands/              # Thư mục chứa các lệnh
│   │   ├── ai.js              # Lệnh !ai (tích hợp Gemini AI)
│   │   ├── echo.js            # Lệnh !echo (lặp lại tin nhắn)
│   │   ├── help.js            # Lệnh !help (danh sách lệnh)
│   │   ├── info.js            # Lệnh !info (thông tin người gửi/nhóm)
│   │   ├── music.js           # Lệnh !music (tìm và gửi nhạc kèm ảnh bìa)
│   │   ├── nhac.js            # Lệnh !nhac (alias của !music)
│   │   ├── ping.js            # Lệnh !ping (kiểm tra độ trễ, uptime)
│   │   └── index.js           # Bộ nạp lệnh tự động
│   ├── utils/
│   │   ├── logger.js          # Ghi log console có màu và timestamp
│   │   ├── musicHelper.js     # Tìm và tải nhạc từ SoundCloud / Spotify
│   │   └── qrHelper.js        # Hiển thị QR trên terminal và lưu file qr.png
│   ├── auth.js                # Xử lý đăng nhập (session hoặc QR code)
│   ├── bot.js                 # Lắng nghe tin nhắn, phân loại và điều hướng lệnh
│   ├── config.js              # Cấu hình dự án từ file .env
│   └── index.js               # Entry point chính
├── .env                       # File cấu hình biến môi trường
├── .env.example               # Mẫu file cấu hình
├── .gitignore
├── package.json
└── README.md
```

---

## Hướng dẫn khởi chạy

### Bước 1: Khởi động bot
Chạy lệnh sau tại thư mục dự án:

```bash
npm start
```

### Bước 2: Quét mã QR đăng nhập
1. Khi chạy lần đầu tiên, bot sẽ tạo ra mã QR:
   - Hiển thị trên cửa sổ Terminal.
   - Lưu thành file ảnh qr.png trong thư mục dự án (có thể mở ảnh để quét).
2. Mở ứng dụng Zalo trên điện thoại > Chọn Quét mã QR > Quét mã vừa hiển thị.
3. Nhấn Xác nhận đăng nhập trên điện thoại.
4. Sau khi đăng nhập thành công, bot tự động lưu session.json. Các lần khởi động sau bot sẽ tự động đăng nhập ngay mà không cần quét lại mã.

---

## Danh sách các lệnh

| Lệnh | Cú pháp | Mô tả |
| :--- | :--- | :--- |
| `ping` | `!ping` | Kiểm tra độ trễ mạng và thời gian bot hoạt động. |
| `help` | `!help` | Xem toàn bộ danh sách lệnh. |
| `info` | `!info` | Xem UID Zalo, tên và thông tin hội thoại. |
| `echo` | `!echo <nội dung>` | Lặp lại tin nhắn vừa nhập. |
| `music` | `!music <tên bài hát hoặc link>` | Tìm nhạc từ SoundCloud/Spotify, gửi ảnh bìa và file audio mp3 vào chat. |
| `nhac` | `!nhac <tên bài hát hoặc link>` | Tên gọi khác của lệnh !music. |
| `ai` | `!ai <câu hỏi>` | Hỏi đáp với trí tuệ nhân tạo Google Gemini (cần API key trong .env). |

---

## Chức năng tìm và gửi nhạc

- Tìm theo tên bài hát bất kỳ trên SoundCloud:
  `!music Chúng ta của tương lai`
  `!nhac Nắng ấm xa dần`
- Gửi link bài hát từ Spotify:
  `!music https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`
- Gửi link bài hát từ SoundCloud:
  `!music https://soundcloud.com/...`

Bot sẽ:
1. Gửi ảnh bìa của bài hát kèm thông tin chi tiết (Tên bài hát, Nghệ sĩ, Nguồn, Thời lượng).
2. Gửi file âm thanh audio (.mp3) trực tiếp lên đoạn chat để nghe.
3. Tự động dọn dẹp các file âm thanh tạm trên máy sau khi gửi.

---

## Hướng dẫn Host Bot chạy 24/7 (Lưu ý về Vercel)

### Tại sao không nên host bot trên Vercel?
- **Vercel** là nền tảng **Serverless / Edge Functions**: Mỗi tiến trình chỉ chạy khi có request HTTP đến và tự động tắt (sleep/terminate) sau **10 đến 60 giây**.
- **Zalo Userbot (`zca-js`)** hoạt động bằng cách kết nối liên tục **WebSocket 24/7** để đón nhận tin nhắn theo thời gian thực.
- Do đó, nếu deploy lên Vercel, bot sẽ bị ngắt kết nối ngay lập tức sau vài giây và không thể nhận được tin nhắn.

### Nền tảng khuyến nghị thay thế (Miễn phí, chạy 24/7)
Các nền tảng hỗ trợ tiến trình chạy ngầm liên tục (Background Worker / Container):
1. **Render.com** (Khuyên dùng nhất - có gói Free Web Service).
2. **Railway.app** (Triển khai 1-click từ GitHub).
3. **Koyeb** (Hỗ trợ 1 micro-instance miễn phí 24/7).
4. **VPS Linux cá nhân** (Dùng `pm2 start src/index.js` hoặc Docker).

---

### Hướng dẫn deploy lên Render.com (3 bước đơn giản)

#### Bước 1: Lấy thông tin phiên đăng nhập (Session)
1. Chạy bot ở máy tính cục bộ một lần và quét mã QR thành công:
   ```bash
   npm start
   ```
2. Mở file `session.json` vừa được tạo trong thư mục dự án, sao chép toàn bộ nội dung bên trong (chuỗi JSON).

#### Bước 2: Đẩy mã nguồn lên GitHub
```bash
git add .
git commit -m "feat: Sẵn sàng deploy cloud"
git push origin master
```

#### Bước 3: Tạo Web Service trên Render
1. Truy cập [Render Dashboard](https://dashboard.render.com/) > Chọn **New +** > **Web Service**.
2. Kết nối tới kho lưu trữ GitHub của dự án.
3. Cấu hình:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Vào mục **Environment Variables** (Biến môi trường) và thêm:
   - `ZALO_SESSION`: Dán toàn bộ nội dung file `session.json` đã copy ở Bước 1.
   - `GEMINI_API_KEY`: Điền API key Google Gemini (nếu muốn dùng tính năng AI).
   - `BOT_PREFIX`: `!` (hoặc tiền tố tùy chọn).
   - `AUTO_REPLY_AI`: `false` (hoặc `true`).
5. Bấm **Deploy Web Service**. Bot sẽ tự động đăng nhập thông qua `ZALO_SESSION` và duy trì hoạt động 24/7!
