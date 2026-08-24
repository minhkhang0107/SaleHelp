# 03 - Tích Hợp Kênh Mạng Xã Hội (Social Channel Integration)

## 1. Mục Đích
Trang cài đặt riêng biệt (nằm trong Settings, truy cập từ Navigation Sidebar) cho phép quản lý danh sách các kênh mạng xã hội kết nối với hệ thống (Zalo OA, Facebook Messenger, Telegram, Instagram).

## 2. Giao Diện & Thành Phần (UI Components)

### Thanh Điều Hướng Tổng Thể (Global Navigation Sidebar)
- Thanh chiều rộng `80px` cố định bên trái, màu nền `#18181B`.
- Icon `Channels` được Highlight với màu **Sapphire Accent (`#2563EB`)**.

### Danh Sách Kênh Kết Nối (Channel Connection List)
Giao diện hiển thị danh sách dạng hàng/thẻ (Card List) cho từng phương thức kết nối:

1. **Thông Tin Kênh**:
   - Logo và Tên nền tảng (Zalo OA, Facebook Messenger, Telegram, Instagram).
   - Mô tả ngắn hoặc thông tin tài khoản kết nối.

2. **Trạng Thái & Thao Tác (Status & Actions)**:
   - **Trạng thái Chưa Ủy Quyền (Not Authorized)**:
     - Nút `Authorize` nổi bật (Sapphire Accent fill `#2563EB`).
     - Khi người dùng nhấn nút, hệ thống khởi chạy luồng OAuth (Zalo OA / Meta Graph API).
   - **Trạng thái Đã Kết Nối (Connected)**:
     - Nhãn trạng thái `Connected` màu Safe Emerald (`#16A34A`).
     - Nút `Disconnect` / `Stop` màu Alert Crimson (`#DC2626`) hoặc Muted Steel outline để tạm dừng nhận tin nhắn.

## 3. Quản Lý Token & Webhook Ngầm
- **Auto Token Refresh**: Dịch vụ Background Job (Cron) chạy định kỳ để làm mới Access Token Zalo OA (hết hạn sau 25h).
- **Webhook Non-Blocking**: Mọi sự kiện tin nhắn đến từ Webhook của Zalo/Facebook được trả về `HTTP 200 OK` ngay lập tức và đẩy task vào Redis Queue để xử lý ngầm.
