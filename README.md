# Zalo Personal Account Bot (Du an Bot Zalo Tai Khoan Ca Nhan)

Du an Zalo Bot chay truc tiep tren tai khoan Zalo ca nhan (Userbot) duoc xay dung bang Node.js va thu vien zca-js. Du an ho tro dang nhap qua ma QR, tu dong luu session, phan nhanh lenh dang module, tim va gui nhac tu SoundCloud/Spotify kem anh bia, va tich hop AI (Google Gemini).

---

## Luu y ve an toan tai khoan

- Zalo chua ho tro API mo cho tai khoan ca nhan. Thu vien hoat dong bang cach mo phong giao thuc Zalo Web.
- Khuyen nghi su dung tai khoan phu (nick test) de chay thu nghiem.
- Khong dung bot de gui tin nhan spam hoac gui tin voi tan suat qua cao de tranh bi khoa tai khoan.
- File session.json chua thong tin cookie dang nhap, tuyet doi khong chia se hoac commit file nay len GitHub.

---

## Cau truc thu muc

```text
zalo bot/
├── src/
│   ├── commands/              # Thu muc chua cac lenh
│   │   ├── ai.js              # Lenh !ai (tich hop Gemini AI)
│   │   ├── echo.js            # Lenh !echo (lap lai tin nhan)
│   │   ├── help.js            # Lenh !help (danh sach lenh)
│   │   ├── info.js            # Lenh !info (thong tin nguoi gui/nhom)
│   │   ├── music.js           # Lenh !music (tim va gui nhac kem anh bia)
│   │   ├── nhac.js            # Lenh !nhac (alias cua !music)
│   │   ├── ping.js            # Lenh !ping (kiem tra do tre, uptime)
│   │   └── index.js           # Bo nap lenh tu dong
│   ├── utils/
│   │   ├── logger.js          # Ghi log console co mau va timestamp
│   │   ├── musicHelper.js     # Tim va tai nhac tu SoundCloud / Spotify
│   │   └── qrHelper.js        # Hien thi QR tren terminal va luu file qr.png
│   ├── auth.js                # Xu ly dang nhap (session hoac QR code)
│   ├── bot.js                 # Lang nghe tin nhan, phan loai va dieu huong lenh
│   ├── config.js              # Cau hinh du an tu file .env
│   └── index.js               # Entry point chinh
├── .env                       # File cau hinh bien moi truong
├── .env.example               # Mau file cau hinh
├── .gitignore
├── package.json
└── README.md
```

---

## Huong dan khoi chay

### Buoc 1: Khoi dong bot
Chay lenh sau tai thu muc du an:

```bash
npm start
```

### Buoc 2: Quet ma QR dang nhap
1. Khi chay lan dau tien, bot se tao ra ma QR:
   - Hien thi tren cua so Terminal.
   - Luu thanh file anh qr.png trong thu muc du an (co the mo anh de quet).
2. Mo ung dung Zalo tren dien thoai > Chon Quet ma QR > Quet ma vua hien thi.
3. Nhan Xac nhan dang nhap tren dien thoai.
4. Sau khi dang nhap thanh cong, bot tu dong luu session.json. Cac lan khoi dong sau bot se tu dong dang nhap ngay ma khong can quet lai ma.

---

## Danh sach cac lenh

| Lenh | Cu phap | Mo ta |
| :--- | :--- | :--- |
| `ping` | `!ping` | Kiem tra do tre mang va thoi gian bot hoat dong. |
| `help` | `!help` | Xem toan bo danh sach lenh. |
| `info` | `!info` | Xem UID Zalo, ten va thong tin hoi thoai. |
| `echo` | `!echo <noi dung>` | Lap lai tin nhan vua nhap. |
| `music` | `!music <ten bai hat hoac link>` | Tim nhac tu SoundCloud/Spotify, gui anh bia va file audio mp3 vao chat. |
| `nhac` | `!nhac <ten bai hat hoac link>` | Ten goi khac cua lenh !music. |
| `ai` | `!ai <cau hoi>` | Hoi dap voi tri tue nhan tao Google Gemini (can API key trong .env). |

---

## Chuc nang tim va gui nhac

- Tim theo ten bai hat bat ky tren SoundCloud:
  `!music Chung ta cua tuong lai`
  `!nhac Nang am xa dan`
- Gui link bai hat tu Spotify:
  `!music https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`
- Gui link bai hat tu SoundCloud:
  `!music https://soundcloud.com/...`

Bot se:
1. Gui anh bia cua bai hat kem thong tin chi tiet (Ten bai hat, Nghe si, Nguon, Thoi luong).
2. Gui file am thanh audio (.mp3) truc tiep len doan chat de nghe.
3. Tu dong don dep cac file am thanh tam tren may sau khi gui.
