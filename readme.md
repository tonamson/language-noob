# Language Noob

Ứng dụng dịch thuật thông minh sử dụng Ollama AI với giao diện chat trực quan.

## 📋 Yêu cầu hệ thống

- Node.js >= 18.x
- npm hoặc yarn
- Ollama (để chạy AI model)

## 🚀 Cài đặt và Khởi động

### Bước 1: Cài đặt Ollama

#### macOS

```bash
# Cài đặt qua Homebrew
brew install ollama

# Hoặc tải từ website: https://ollama.ai/download
```

#### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Windows

Tải và cài đặt từ: https://ollama.ai/download

### Bước 2: Khởi động Ollama

```bash
# Khởi động Ollama service
ollama serve
```

Ollama sẽ chạy tại `http://localhost:11434` (mặc định).

### Bước 3: Tải model qwen3:8b

```bash
# Tải model qwen3:8b
ollama pull qwen3:8b
```

**Lưu ý**: Model này có dung lượng khoảng 4-5GB, quá trình tải có thể mất vài phút tùy vào tốc độ internet.

### Bước 4: Cài đặt dependencies cho API

```bash
cd api
npm install
```

### Bước 5: Cài đặt dependencies cho Frontend

```bash
cd frontend
npm install
# hoặc
yarn install
```

### Bước 6: Cấu hình biến môi trường

#### API (.env trong thư mục `api/`)

Tạo file `.env` trong thư mục `api/`:

```bash
cd api
touch .env
```

Nội dung file `.env`:

```env
# Port cho API server
# ⚠️ LƯU Ý: Port hiện đang hardcode là 2053 trong main.ts
# Biến PORT này chưa được sử dụng trong code, chỉ để tham khảo
PORT=2053

# URL của Ollama API
# ✅ BẮT BUỘC: Nếu Ollama chạy ở port khác, cần set biến này
# Mặc định: http://localhost:11434
OLLAMA_API_URL=http://localhost:11434

# URL của Frontend (để cấu hình CORS)
# ⚠️ LƯU Ý: Hiện tại CORS cho phép tất cả origins (origin: true)
# Biến này chưa được sử dụng trong code, chỉ để tham khảo
FRONTEND_URL=http://localhost:3000
```

**Lưu ý quan trọng**: 
- **OLLAMA_API_URL**: Đây là biến **QUAN TRỌNG NHẤT** và được sử dụng trong `TranslateService`
- Nếu không set `OLLAMA_API_URL`, hệ thống sẽ dùng giá trị mặc định `http://localhost:11434`
- Nếu Ollama chạy ở port khác hoặc host khác, **BẮT BUỘC** phải set biến này
- Port API hiện đang hardcode là `2053` trong `main.ts`, biến `PORT` chưa được sử dụng
- File `.env` sẽ không được commit lên git (đã có trong `.gitignore`)

#### Frontend (.env.local trong thư mục `frontend/`)

Tạo file `.env.local` trong thư mục `frontend/`:

```bash
cd frontend
touch .env.local
```

Nội dung file `.env.local`:

```env
# URL của API server
# ✅ BẮT BUỘC: Phải set biến này để frontend có thể kết nối với API
# Nếu không set, axios sẽ dùng undefined và gọi relative URL (sẽ gây lỗi)
# Lưu ý: Biến NEXT_PUBLIC_* sẽ được expose ra client-side (public, không bảo mật)
NEXT_PUBLIC_API_URL=http://localhost:2053
```

**Lưu ý quan trọng**: 
- **NEXT_PUBLIC_API_URL**: Đây là biến **BẮT BUỘC** để frontend có thể kết nối với API server
- Biến `NEXT_PUBLIC_*` sẽ được bundle vào client-side code (public, ai cũng có thể xem)
- Nếu không set biến này, axios sẽ dùng `undefined` và gọi relative URL → **SẼ GÂY LỖI**
- Nếu API chạy ở port khác, **BẮT BUỘC** phải cập nhật giá trị này
- File `.env.local` sẽ không được commit lên git (đã có trong `.gitignore`)

### Bước 7: Khởi động API Server

```bash
cd api

# Development mode (với hot reload)
npm run dev

# Hoặc production mode
npm run build
npm run start:prod
```

API server sẽ chạy tại: **http://localhost:2053**

### Bước 8: Khởi động Frontend

Mở terminal mới:

```bash
cd frontend

# Development mode
npm run dev
# hoặc
yarn dev
```

Frontend sẽ chạy tại: **http://localhost:3000**

## 📖 Sử dụng

1. Mở trình duyệt và truy cập: `http://localhost:3000`
2. Chọn **"Dịch theo Chat"**
3. Chọn chế độ dịch:
   - **Tự phát hiện ngôn ngữ**: Dịch từ bất kỳ ngôn ngữ nào sang Tiếng Việt
   - **Ngôn ngữ muốn dịch**: Dịch từ Tiếng Việt sang ngôn ngữ đã chọn
4. Nhập văn bản và nhấn Enter để dịch

## 🔧 API Endpoints

### POST /translate

Dịch văn bản từ ngôn ngữ A sang ngôn ngữ B.

**Request Body:**

```json
{
  "prompt": "Hello, how are you?",
  "sourceLanguage": "English", // Optional: tự phát hiện nếu không có
  "targetLanguage": "Tiếng Việt" // Optional: mặc định Tiếng Việt
}
```

**Response:**

```json
{
  "translatedText": "Xin chào, bạn khỏe không?",
  "model": "qwen3:8b",
  "duration": 1234
}
```

## 🛠️ Cấu trúc Project

```
language-noob/
├── api/                 # NestJS Backend API
│   ├── src/
│   │   ├── translate/  # Module dịch thuật
│   │   └── main.ts     # Entry point
│   └── package.json
│
├── frontend/            # Next.js Frontend
│   ├── app/
│   │   ├── chat/       # Trang chat dịch thuật
│   │   └── services/   # API services
│   └── package.json
│
└── readme.md
```

## ⚙️ Cấu hình

### Model được sử dụng

- **Model**: `qwen3:8b`
- **Temperature**: 0.1 (có thể điều chỉnh trong code)
- **Context Window**: Tự động điều chỉnh dựa trên độ dài văn bản (512-4096 tokens)

### Ngôn ngữ được hỗ trợ

- Tiếng Việt
- English (Tiếng Anh)
- 中文 (Tiếng Trung)
- 日本語 (Tiếng Nhật)
- 한국어 (Tiếng Hàn)
- Français (Tiếng Pháp)
- Deutsch (Tiếng Đức)
- Español (Tiếng Tây Ban Nha)
- Italiano (Tiếng Ý)
- Português (Tiếng Bồ Đào Nha)
- Русский (Tiếng Nga)
- العربية (Tiếng Ả Rập)
- ไทย (Tiếng Thái)

## 🐛 Troubleshooting

### Ollama không kết nối được

1. Kiểm tra Ollama đã chạy chưa:

   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Kiểm tra model đã được tải chưa:

   ```bash
   ollama list
   ```

3. Nếu model chưa có, tải lại:
   ```bash
   ollama pull qwen3:8b
   ```

4. Nếu Ollama chạy ở port khác, cập nhật `OLLAMA_API_URL` trong file `.env` của API:
   ```env
   OLLAMA_API_URL=http://localhost:PORT_KHAC
   ```
   Sau đó **restart API server**.

### API không khởi động được

1. Kiểm tra port 2053 đã được sử dụng chưa:

   ```bash
   lsof -i :2053  # macOS/Linux
   netstat -ano | findstr :2053  # Windows
   ```

2. Thay đổi port trong file `api/src/main.ts` (hiện đang hardcode)

3. Kiểm tra dependencies đã được cài đặt:
   ```bash
   cd api
   npm install
   ```

### Frontend không kết nối được API

1. **Kiểm tra biến môi trường `NEXT_PUBLIC_API_URL`**:
   - Mở file `frontend/.env.local`
   - Đảm bảo có dòng: `NEXT_PUBLIC_API_URL=http://localhost:2053`
   - Nếu API chạy ở port khác, cập nhật giá trị này

2. **Kiểm tra API server đã chạy chưa**:
   ```bash
   curl http://localhost:2053
   # Hoặc mở browser: http://localhost:2053
   ```

3. **Kiểm tra CORS**:
   - API đã được cấu hình CORS cho phép tất cả origins
   - Nếu vẫn lỗi, kiểm tra console của browser để xem lỗi cụ thể

4. **Restart frontend sau khi thay đổi `.env.local`**:
   ```bash
   # Dừng frontend (Ctrl+C)
   # Khởi động lại
   npm run dev
   ```
   **Lưu ý**: Next.js chỉ load biến môi trường khi khởi động, cần restart sau khi thay đổi

### Lỗi "Cannot connect to Ollama API"

1. Kiểm tra Ollama đã chạy:
   ```bash
   ollama serve
   ```

2. Kiểm tra `OLLAMA_API_URL` trong file `.env` của API:
   ```env
   OLLAMA_API_URL=http://localhost:11434
   ```

3. Kiểm tra kết nối đến Ollama:
   ```bash
   curl http://localhost:11434/api/tags
   ```

4. Nếu Ollama chạy ở host/port khác, cập nhật `OLLAMA_API_URL` và **restart API server**

## 📝 Scripts hữu ích

### API

```bash
npm run dev          # Development với hot reload
npm run build        # Build production
npm run start:prod   # Chạy production
npm run lint         # Lint code
```

### Frontend

```bash
npm run dev          # Development server
npm run build        # Build production
npm run start        # Chạy production
npm run lint         # Lint code
```

## 📄 License

UNLICENSED
