# Cấu hình API Link

Frontend có thể được cấu hình để gọi API ở bất kỳ URL nào thông qua file `config.json` hoặc biến môi trường `API_LINK`.

## Cách cấu hình

### 1. Qua file `config.json` (Có thể chỉnh sửa sau khi build)

File `config.json` được copy vào app và **có thể chỉnh sửa sau khi build**.

**Vị trí file sau khi build:**

- macOS: `Language Noob.app/Contents/Resources/config.json`
- Windows: `resources/config.json` (trong thư mục app)
- Linux: `resources/config.json` (trong thư mục app)
- Hoặc cùng thư mục với executable file

**Chỉnh sửa file:**

```json
{
  "apiLink": "http://127.0.0.1:2053"
}
```

### 2. Qua Environment Variable (Ưu tiên cao nhất)

Khi build hoặc chạy Electron app, set biến môi trường `API_LINK`:

```bash
# Build với API link tùy chỉnh
API_LINK=https://api.example.com npm run build:mac

# Hoặc chạy với API link tùy chỉnh
API_LINK=http://192.168.1.100:3000 npm run start:electron
```

### 3. Thứ tự ưu tiên

1. **Environment Variable `API_LINK`** (cao nhất)
2. **File `config.json`** (có thể chỉnh sửa sau khi build)
3. **Mặc định**: `http://127.0.0.1:2053` (port của API build)

## Lưu ý

- File `config.json` **KHÔNG** bị bundle vào asar, có thể chỉnh sửa sau khi build
- Nếu không có `config.json` hoặc không set `apiLink`, sẽ dùng mặc định `http://127.0.0.1:2053`
- Nếu `API_LINK` trỏ đến localhost (`127.0.0.1` hoặc `localhost`), Electron sẽ tự động khởi động API server local
- Nếu `API_LINK` trỏ đến remote server, Electron sẽ không khởi động API server local
- API server local sẽ tự động đọc port từ URL trong `API_LINK` (nếu là localhost)

## Ví dụ

### Sử dụng API local (mặc định)

```json
{
  "apiLink": "http://127.0.0.1:2053"
}
```

### Sử dụng API remote

```json
{
  "apiLink": "https://api.myserver.com"
}
```

### Sử dụng API trên mạng local

```json
{
  "apiLink": "http://192.168.1.100:3000"
}
```

## Cách chỉnh sửa sau khi build

1. Tìm file `config.json` trong thư mục Resources của app
2. Mở bằng text editor
3. Thay đổi giá trị `apiLink`
4. Lưu và restart app
