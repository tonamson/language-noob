# Language Noob - Frontend

Ứng dụng dịch thuật thông minh với Next.js

## Tính năng

- **Dịch theo Chat**: Dịch thuật theo dạng hội thoại chat
- **Dịch theo Quét Màn hình**: Chụp màn hình và dịch nội dung (sử dụng Web Screen Capture API)

## Cài đặt

```bash
npm install
```

## Development

### Chạy Next.js dev server

```bash
npm run dev
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`

## Build

### Build Next.js (static export)

```bash
npm run build
```

Output sẽ được tạo trong thư mục `dist/`

### Chạy production build

```bash
npm run start
```

## Cấu trúc thư mục

```
frontend/
├── app/              # Next.js app directory
│   ├── page.tsx      # Landing page
│   ├── chat/         # Chat translation page
│   ├── screen-scan/  # Screen scan translation page
│   └── services/     # API services
├── dist/             # Next.js build output (static export)
└── package.json
```

## Cấu hình API

API URL có thể được cấu hình qua biến môi trường:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:2053
```

Nếu không cấu hình, mặc định sẽ sử dụng `http://localhost:2053`

## Tính năng Chụp Màn hình

Ứng dụng sử dụng **Web Screen Capture API** để chụp màn hình trực tiếp trên browser.

### Yêu cầu:
- HTTPS hoặc localhost (bắt buộc bởi browser)
- Browser hỗ trợ: Chrome 72+, Edge 79+, Firefox 66+, Safari 13+

### Cách sử dụng:
1. Nhấn nút "Chụp Màn Hình"
2. Chọn màn hình/cửa sổ/tab từ dialog của browser
3. Vẽ box trên ảnh để crop và dịch

## License

Private
