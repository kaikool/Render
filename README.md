# TradingView Screenshot Service

Service Node.js sử dụng Express và Puppeteer để chụp ảnh biểu đồ TradingView có xác thực, tối ưu hóa cho việc deploy trên Render Free Plan.

## Tính năng

- 📸 Chụp ảnh biểu đồ TradingView với xác thực
- 🔐 Hỗ trợ xác thực bằng cookie
- 🚀 Tối ưu hóa cho Render Free Plan
- ⚡ Thời gian phản hồi nhanh với chrome-aws-lambda
- 🛡️ Xử lý lỗi và validation đầy đủ
- 📊 Endpoint kiểm tra sức khỏe

## API Endpoints

### GET /health
Kiểm tra trạng thái hoạt động của service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-05-26T05:28:44.371Z"
}
```

### GET /screenshot

Chụp ảnh biểu đồ TradingView cho symbol được chỉ định.

**Query Parameters:**
- `symbol` (bắt buộc): Mã giao dịch theo định dạng `EXCHANGE:PAIR` (ví dụ: `BINANCE:BTCUSDT`)

**Example Request:**
```bash
curl "https://your-service.onrender.com/screenshot?symbol=BINANCE:BTCUSDT" -o btc_chart.png
```

**Response:**
- Trả về ảnh PNG của biểu đồ TradingView
- Content-Type: `image/png`

## Cài đặt và Cấu hình

### 1. Chuẩn bị Cookie TradingView

Để service có thể truy cập TradingView với tài khoản cá nhân, bạn cần cung cấp cookie đăng nhập:

#### Cách lấy cookie:
1. Đăng nhập vào TradingView trong trình duyệt
2. Mở Developer Tools (F12)
3. Vào tab Application → Cookies → https://www.tradingview.com
4. Copy các cookie quan trọng như `sessionid`, `device_t`, etc.

#### Định dạng cookie trong file `cookies.json`:
```json
[
  {
    "name": "sessionid",
    "value": "your-actual-session-id",
    "domain": ".tradingview.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
  },
  {
    "name": "device_t",
    "value": "your-device-token",
    "domain": ".tradingview.com",
    "path": "/",
    "httpOnly": false,
    "secure": true,
    "sameSite": "None"
  }
]
```

### 2. Deploy lên Render

#### Bước 1: Tạo tài khoản Render
1. Truy cập [render.com](https://render.com)
2. Đăng ký tài khoản miễn phí

#### Bước 2: Deploy từ GitHub
1. Push code lên GitHub repository
2. Kết nối GitHub với Render
3. Tạo Web Service mới từ repository

#### Bước 3: Cấu hình Environment Variables
Trong Render Dashboard, thêm biến môi trường:
- `NODE_ENV`: `production`
- `COOKIE_JSON`: Paste nội dung file cookies.json (dạng JSON string)

#### Bước 4: Cấu hình Build & Deploy
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Plan**: Free

### 3. Alternative: Deploy bằng render.yaml

Service đã có sẵn file `render.yaml` để deploy tự động:

```yaml
services:
  - type: web
    name: tradingview-screenshot-service
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: COOKIE_JSON
        sync: false
```

## Sử dụng

### Test trên local:
```bash
# Kiểm tra health
curl http://localhost:5000/health

# Chụp ảnh BTC/USDT
curl "http://localhost:5000/screenshot?symbol=BINANCE:BTCUSDT" -o btc_chart.png
```

### Sử dụng trong production:
```javascript
// JavaScript/Node.js
const response = await fetch('https://your-service.onrender.com/screenshot?symbol=BINANCE:BTCUSDT');
const buffer = await response.arrayBuffer();
const imageData = Buffer.from(buffer);

// Python
import requests
response = requests.get('https://your-service.onrender.com/screenshot?symbol=BINANCE:BTCUSDT')
with open('chart.png', 'wb') as f:
    f.write(response.content)
```

## Error Handling

Service xử lý các lỗi phổ biến:

- **400**: Symbol không hợp lệ
- **408**: Timeout khi load biểu đồ
- **500**: Lỗi hệ thống
- **502**: Không thể kết nối TradingView

## Hỗ trợ

- Service hỗ trợ tất cả symbol có trên TradingView
- Thời gian chờ tối đa: 30 giây
- Kích thước ảnh: 1920x1080 pixels
- Định dạng: PNG

## Lưu ý

- Cookie có thể hết hạn, cần cập nhật định kỳ
- Render Free Plan có giới hạn 750 giờ/tháng
- Service sẽ sleep sau 15 phút không hoạt động (Render Free Plan)
