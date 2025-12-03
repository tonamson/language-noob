# Language Noob - Frontend

Ứng dụng dịch thuật thông minh với Electron và Next.js

## Tính năng

- **Dịch theo Chat**: Dịch thuật theo dạng hội thoại chat
- **Dịch theo Quét Màn hình**: Chọn và quét màn hình để dịch nội dung

## Cài đặt

```bash
npm install
```

## Development

### Chạy Next.js dev server

```bash
npm run dev
```

### Chạy Electron trong development mode

```bash
npm run dev:electron
```

Lệnh này sẽ:
1. Tự động khởi động Next.js dev server
2. Mở Electron app và load từ `http://localhost:3000`

## Build

### Build Next.js (static export)

```bash
npm run build
```

Output sẽ được tạo trong thư mục `dist/`

### Build Electron App

#### Build cho tất cả platform

```bash
npm run build:all
```

#### Build cho Windows

```bash
npm run build:win
```

Output:
- `release/Language Noob Setup x.x.x.exe` (NSIS installer)
- `release/Language Noob x.x.x.exe` (Portable)

#### Build cho macOS

```bash
npm run build:mac
```

Output:
- `release/Language Noob-x.x.x.dmg` (DMG installer)
- `release/Language Noob-x.x.x-mac.zip` (ZIP archive)

**Lưu ý**: Để build cho macOS, bạn cần:
- Chạy trên macOS
- Có Xcode Command Line Tools
- Có thể cần Apple Developer Certificate để code sign (tùy chọn)

#### Build cho Linux

```bash
npm run build:linux
```

Output:
- `release/Language Noob-x.x.x.AppImage`
- `release/Language Noob-x.x.x.deb`
- `release/Language Noob-x.x.x.rpm`

## Cấu trúc thư mục

```
frontend/
├── app/              # Next.js app directory
│   ├── page.tsx      # Landing page
│   ├── chat/         # Chat translation page
│   └── screen-scan/  # Screen scan translation page
├── dist/             # Next.js build output (static export)
├── main.js           # Electron main process
├── release/          # Electron build output
└── package.json
```

## Icon

Để build app với icon tùy chỉnh, đặt các file icon vào thư mục `build/`:

- `build/icon.ico` - Windows icon (256x256)
- `build/icon.icns` - macOS icon (512x512)
- `build/icon.png` - Linux icon (512x512)

Nếu không có icon, electron-builder sẽ sử dụng icon mặc định.

## Troubleshooting

### Lỗi routing trong Electron

Nếu gặp lỗi `ERR_FILE_NOT_FOUND` khi navigate giữa các trang:

1. Đảm bảo đã build Next.js: `npm run build`
2. Kiểm tra file `dist/` có đầy đủ các route không
3. Chạy lại Electron: `npm run start:electron`

### Build cho macOS trên Windows/Linux

Không thể build macOS app trên Windows hoặc Linux. Bạn cần:
- Chạy trên macOS
- Hoặc sử dụng CI/CD (GitHub Actions, CircleCI, etc.)

### Code Signing (macOS)

Để code sign app macOS (không bắt buộc nhưng khuyến nghị):

1. Có Apple Developer Account
2. Export certificate và đặt vào keychain
3. Cấu hình trong `package.json`:

```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

## License

Private
