# 04 - Màn Hình Dashboard Quản Lý Chat & Takeover (Chat Dashboard)

## 1. Mục Đích
Màn hình trung tâm (Cockpit) cho phép tổng đài viên theo dõi tất cả các cuộc trò chuyện thời gian thực từ đa kênh (Zalo, Messenger) và thực hiện can thiệp (Human Takeover) khi AI tư vấn chưa chính xác.

## 2. Giao Diện Bố Cục 3 Cột (20% - 50% - 30%)

### Thanh Điều Hướng Tổng Thể (Global Navigation Sidebar)
- Thanh chiều rộng `80px` cố định bên trái, màu nền `#18181B`.
- Icon `Chat` được Highlight với màu **Sapphire Accent (`#2563EB`)**.

### Cột 1 (20% Width): Omnichannel Inbox
- Danh sách cuộc hội thoại gần đây.
- Thẻ thông tin khách: Avatar, Tên khách hàng, Tag nền tảng (Zalo/Messenger), Snippet tin nhắn cuối cùng.

### Cột 2 (50% Width): Active Chat Window
- Khung hiển thị luồng hội thoại giữa Khách hàng và AI Bot.
- **Confidence Score Pill**: Gắn nhãn điểm tin cậy bên cạnh mỗi tin nhắn của AI.
  - Điểm cao (> 0.85): Màu Safe Emerald (`#16A34A`).
  - Điểm thấp (< 0.70): Màu Alert Crimson (`#DC2626`).
- Khung nhập tin nhắn trực tiếp ở đáy màn hình dành cho nhân viên gõ câu trả lời.

### Cột 3 (30% Width): Agent Control Panel & Context Summary
- **Công Tắc Human Takeover**: Công tắc toggle lớn trên cùng. Khi bật sang `Human Agent`, hệ thống khóa tính năng AI Auto-reply cho phiên chat này.
- **Tóm Tắt Khách Hàng**: Tên, Số điện thoại, Kênh liên hệ.
- **Trích Dẫn Tri Thức Đã Dùng (Retrieved Context)**: Hiển thị các thông tin Tour / Ưu đãi mà RAG đã truy xuất từ trang Knowledge Base để AI tạo ra câu trả lời hiện tại.
