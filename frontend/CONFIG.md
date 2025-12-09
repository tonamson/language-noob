# Cấu hình API

Frontend có thể được cấu hình để gọi API ở bất kỳ URL nào thông qua biến môi trường.

## Cách cấu hình

### Qua Environment Variable

Tạo file `.env.local` trong thư mục `frontend/`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:2053
```

### Thứ tự ưu tiên

1. **Environment Variable `NEXT_PUBLIC_API_URL`**
2. **Mặc định**: `http://localhost:2053`

## Ví dụ

### Development với API local

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:2053
```

### Production với API remote

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.example.com
```

### API trên mạng local

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://192.168.1.100:2053
```

## Build với API URL tùy chỉnh

```bash
# Build với API URL cụ thể
NEXT_PUBLIC_API_URL=https://api.example.com npm run build
```

## Lưu ý

- Biến môi trường **phải** bắt đầu bằng `NEXT_PUBLIC_` để Next.js expose cho client-side code
- Thay đổi `.env` files cần rebuild app để có hiệu lực
- File `.env.local` không nên commit vào git (đã có trong `.gitignore`)
