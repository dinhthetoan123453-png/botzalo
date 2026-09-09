# 🤖 Zalo Personal Account Bot (Dự án Bot Zalo Tài Khoản Cá Nhân)

Dự án Zalo Bot chạy trực tiếp trên **tài khoản Zalo cá nhân** (Userbot) được xây dựng bằng **Node.js** và thư viện **`zca-js`**. Dự án hỗ trợ đăng nhập qua mã QR, tự động lưu session để không phải quét lại mã, cấu trúc phân nhánh lệnh dạng module và tích hợp AI (Google Gemini).

---

## ⚠️ Lưu ý quan trọng về an toàn tài khoản

> [!WARNING]
> Zalo **chưa hỗ trợ API chính thức** cho tài khoản cá nhân (họ chỉ hỗ trợ Zalo Official Account dành cho doanh nghiệp có giấy phép). Do đó, thư viện này hoạt động bằng cách **mô phỏng Zalo Web**.
>
> 1. **Khuyến cáo dùng nick phụ:** Nên dùng một tài khoản phụ / sim rác để chạy thử nghiệm bot trước khi tích hợp vào tài khoản chính.
> 2. **Chống Spam:** Không nên gửi tin nhắn hàng loạt hoặc spam trong thời gian ngắn để tránh việc Zalo kích hoạt cơ chế checkpoint khóa tài khoản.
> 3. **Bảo mật Session:** File `session.json` chứa cookie đăng nhập của bạn. **Tuyệt đối không gửi hoặc commit file này lên GitHub**.
> 4. **Tránh xung đột Web:** Một tài khoản chỉ nên duy trì một phiên Zalo Web hoạt động tại một thời điểm. Nếu bạn mở Zalo Web trên trình duyệt thì bot có thể bị ngắt kết nối tạm thời.

---

## 📁 Cấu trúc thư mục dự án

```text
zalo bot/
├── src/
│   ├── commands/              # Thư mục chứa các lệnh của bot
│   │   ├── ai.js              # Lệnh !ai (tích hợp Gemini AI)
│   │   ├── echo.js            # Lệnh !echo (lặp lại tin nhắn)
│   │   ├── help.js            # Lệnh !help (danh sách lệnh)
│   │   ├── info.js            # Lệnh !info (thông tin người gửi/nhóm)
│   │   ├── ping.js            # Lệnh !ping (kiểm tra độ trễ, uptime)
│   │   └── index.js           # Bộ tải lệnh tự động
│   ├── utils/
│   │   ├── logger.js          # Ghi log console có màu và timestamp
│   │   └── qrHelper.js        # Hiển thị QR trên terminal và lưu file qr.png
│   ├── auth.js                # Xử lý đăng nhập (session hoặc QR code)
│   ├── bot.js                 # Lắng nghe tin nhắn, phân loại & điều hướng lệnh
│   ├── config.js              # Cấu hình dự án từ file .env
│   └── index.js               # Entry point chính
├── .env                       # File cấu hình biến môi trường
├── .env.example               # Mẫu file cấu hình
├── .gitignore                 # Bỏ qua node_modules, session.json, qr.png
├── package.json
└── README.md
```

---

## 🚀 Hướng dẫn cài đặt và khởi chạy

### Bước 1: Khởi động bot
Chạy lệnh sau tại thư mục dự án:

```bash
npm start
```

### Bước 2: Quét mã QR đăng nhập
1. Khi chạy lần đầu tiên, bot sẽ tạo ra mã QR:
   - Hiển thị trực tiếp dạng ASCII trên cửa sổ **Terminal**.
   - Đồng thời lưu thành file ảnh `qr.png` trong thư mục dự án (bạn có thể mở file này để quét nếu terminal bị vỡ hình).
2. Mở ứng dụng **Zalo trên điện thoại** > Chọn biểu tượng **Quét mã QR** > Quét mã vừa hiển thị.
3. Nhấn **Xác nhận đăng nhập** trên điện thoại.
4. Sau khi đăng nhập thành công, bot sẽ tự động tạo file `session.json`. Từ các lần khởi động tiếp theo, bot sẽ **tự động đăng nhập qua session** mà không cần quét lại mã QR nữa!

---

## ⚙️ Cấu hình biến môi trường (`.env`)

Mở file `.env` để tuỳ chỉnh các thiết lập:

```ini
# Tiền tố của lệnh (mặc định là !)
BOT_PREFIX=!

# Tự động trả lời mọi tin nhắn riêng tư bằng AI (true/false)
AUTO_REPLY_AI=false

# API Key của Google Gemini (miễn phí)
# Lấy tại: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=

# Mô hình AI sử dụng
GEMINI_MODEL=gemini-2.5-flash

# Thời gian nghỉ an toàn (ms) để tránh bị Zalo phát hiện bot
SAFE_DELAY_MIN=1000
SAFE_DELAY_MAX=2500
```

---

## 💬 Danh sách các lệnh có sẵn

| Lệnh | Cú pháp | Mô tả |
| :--- | :--- | :--- |
| `ping` | `!ping` | Kiểm tra thời gian phản hồi, trạng thái và thời gian hoạt động của bot. |
| `help` | `!help` | Hiển thị danh sách tất cả các lệnh bot đang hỗ trợ. |
| `info` | `!info` | Xem thông tin ID, tên người gửi và loại phòng chat (nhóm hay riêng tư). |
| `echo` | `!echo <nội dung>` | Lặp lại nội dung bạn vừa nhập. |
| `ai` | `!ai <câu hỏi>` | Hỏi đáp với trợ lý AI Google Gemini. |

---

## 🛠️ Hướng dẫn tự tạo thêm lệnh mới

Để tạo một lệnh mới, bạn chỉ cần tạo một file `.js` mới trong thư mục `src/commands/`. Bot sẽ tự động tải lệnh này mà không cần sửa code ở nơi khác!

**Ví dụ:** Tạo file `src/commands/chucmung.js`:

```javascript
module.exports = {
  name: 'chucmung',
  description: 'Gửi lời chúc mừng ngẫu nhiên',
  usage: '!chucmung',
  async execute({ api, message, threadId, threadType }) {
    const loiChuc = [
      'Chúc bạn một ngày tràn đầy năng lượng và niềm vui! 🌟',
      'Vạn sự như ý, tỷ sự như mơ! ✨',
      'Chúc công việc của bạn luôn thuận buồm xuôi gió! 🚀',
    ];
    const randomChuc = loiChuc[Math.floor(Math.random() * loiChuc.length)];

    await api.sendMessage(
      {
        msg: randomChuc,
        quote: message.data, // Trả lời trích dẫn tin nhắn gốc
      },
      threadId,
      threadType
    );
  },
};
```
Sau đó người dùng trong chat chỉ cần gõ `!chucmung` là bot sẽ phản hồi ngay!
