# 03 - Tích Hợp Kênh Mạng Xã Hội (Social Channel Integration)

## 1. Mục Đích
Kết nối Web App với các nền tảng chat phổ biến (Zalo OA, Facebook Messenger, Telegram) để nhận và trả lời tin nhắn tự động.

## 2. Giao Diện (Màn Hình Channels)
- Danh sách các nền tảng hỗ trợ (Thẻ Card cho mỗi nền tảng).
- **Trang Cấu hình Zalo OA**:
  - Nhập `App ID`, `Secret Key`, `Zalo OA ID`.
  - Nút "Liên Kết Zalo OA" (Chạy luồng Zalo OAuth để lấy `Authorization Code` -> Đổi lấy `Access Token` & `Refresh Token`).
  - Cung cấp URL Webhook để user dán vào trang quản lý Zalo Developer.
- **Trang Cấu hình Facebook Messenger**:
  - Nhập `Page Access Token`, `Verify Token` tự tạo.
  - Cung cấp URL Webhook.

## 3. Quản Lý Token & Rủi Ro Zalo OA
- **Access Token Zalo**: Hết hạn trong 25 giờ.
- **Refresh Token Zalo**: Hết hạn trong 90 ngày (tuỳ version API).
- **Cron Service (Background Job)**: 
  - Chạy ngầm định kỳ (ví dụ: 12 giờ một lần).
  - Quét trong DB các tài khoản Zalo OA có `access_token` sắp hết hạn.
  - Gọi API `/v4/oa/access_token` để lấy token mới.
  - Cập nhật vào DB. Nếu thất bại (do Refresh Token chết), gửi email hoặc thông báo Notification trên Dashboard cho người dùng để họ cấp quyền lại.

## 4. Xử Lý Webhook Cấp Bách (Timeout Prevention)
- Khi Zalo/Facebook gọi Webhook đến App của chúng ta (khi có khách nhắn tin).
- Zalo/Meta yêu cầu hệ thống phải phản hồi `HTTP 200 OK` nhanh nhất có thể (Zalo yêu cầu < 2 giây).
- **Flow**:
  1. Gateway nhận payload, verify Signature (`X-Zalo-Signature` hoặc `X-Hub-Signature`).
  2. Không gọi RAG/AI ngay lập tức.
  3. JSON Payload được chuyển thành task, đẩy vào Message Queue (Redis / BullMQ).
  4. Trả về `HTTP 200 OK`.
  5. Worker ở backend sẽ từ từ lấy task ra, tìm kiếm RAG, gọi LLM và gửi API trả lời lại cho người dùng.
