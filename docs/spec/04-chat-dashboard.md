# 04 - Màn Hình Dashboard Quản Lý Chat & Takeover (Chat Dashboard)

## 1. Mục Đích
Màn hình chuyên biệt dành cho tổng đài viên theo dõi các cuộc trò chuyện thời gian thực từ Zalo OA / Facebook Messenger và can thiệp (Human Takeover) khi cần thiết.

## 2. Bố Cục 3 Cột (20% - 50% - 30%)
Giao diện kết hợp với **Global Navigation Menu** ở sát bên trái.

### Cột Trái (20%): Omnichannel Inbox
- Danh sách hội thoại khách hàng gần đây.
- Thẻ thông tin khách: Avatar, Tên khách hàng, Tag nền tảng (Zalo/Messenger), Nội dung tin nhắn mới nhất.

### Cột Giữa (50%): Active Chat Window
- Khung hội thoại chính giữa Khách hàng và AI Bot.
- Gắn điểm tin cậy (**Confidence Score**) bên cạnh các câu trả lời của AI (Xanh emerald khi >0.85, Đỏ crimson khi <0.70).
- Khung nhập liệu chat ở phía dưới dành cho nhân viên khi chuyển chế độ.

### Cột Phải (30%): Agent Control Panel & Context Summary
- **Công tắc Human Takeover**: Công tắc lớn ở trên cùng để bật/tắt chế độ AI tự động trả lời.
- **Tóm tắt thông tin khách hàng**: Tên, SĐT, Nguồn kênh.
- **Trích dẫn tri thức đã dùng (Retrieved Context)**: Hiển thị các đoạn thông tin Tour/Ưu đãi mà AI đã dùng để trả lời tin nhắn hiện tại (được truy xuất tự động từ trang Knowledge Base).
