# 04 - Dashboard Quản Lý Chat & Cấp Cứu Kịp Thời (Chat Dashboard & Takeover)

## 1. Mục Đích
Cho phép Admin/Nhân viên trực tổng đài theo dõi AI đang trả lời khách hàng như thế nào, và can thiệp (Takeover) ngay khi AI không tự tin trả lời.

## 2. Tính Năng Chính
1. **Lịch Sử Tin Nhắn Đa Kênh (Omnichannel Inbox)**:
   - Giao diện giống các ứng dụng livechat (ví dụ: Pancake, vChat).
   - Tích hợp các cuộc hội thoại từ Zalo, Messenger chung vào một màn hình duy nhất.

2. **Chỉ Số Tin Cậy (Confidence Score Indicator)**:
   - Cạnh mỗi tin trả lời của AI sẽ có nhãn (Label) biểu thị độ tin cậy.
   - Xanh lá (High Confidence): > 0.85
   - Vàng (Medium): 0.70 - 0.85
   - Đỏ (Low/Threshold Failed): < 0.70. (Khi thấp hơn ngưỡng này, AI sẽ gửi tin báo bận và không tự trả lời).

3. **Chế Độ Bàn Giao (Human Takeover)**:
   - Khi có điểm đỏ hoặc khi khách chat lệnh đặc biệt (ví dụ: "gặp nhân viên"), hệ thống báo Noti màu đỏ.
   - Có nút chuyển đổi trạng thái (Toggle) trên đầu khung chat: `[ AI Auto-reply ]` <-> `[ Human Agent ]`.
   - Nếu đổi sang Human, AI tạm dừng phản hồi luồng chat này trong khoảng X giờ (ví dụ: 12 tiếng), sau đó tự động bật lại hoặc khi nhân viên đóng phiên chat.

4. **Theo Dõi Thống Kê (Analytics)**:
   - Số tin nhắn AI đã trả lời / Số tin nhắn nhân viên xử lý.
   - Tỷ lệ giảm tải (Deflection rate).
