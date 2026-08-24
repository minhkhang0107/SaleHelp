# 02 - Trình Biên Tập Tri Thức Mở Rộng (Accordion Web Editor)

## 1. Mục Đích
Chi tiết kỹ thuật và hành vi tương tác (UX Interaction) của Trình biên tập tri thức dạng Accordion trong phân hệ Knowledge Base.

## 2. Quy Tắc Tương Tác Accordion (UX Behavior)
1. **Chế độ Mở/Đóng**:
   - Mặc định các hàng Tour/Khuyến mãi ở trạng thái Thu gọn (Collapsed) để đảm bảo mật độ dữ liệu cao (Data-dense).
   - Nhấn vào bất kỳ vị trí nào trên hàng để Mở rộng (Expand) xem chi tiết.
   - Chỉ cho phép mở rộng 1 hàng tại một thời điểm hoặc mở đồng thời (Accordion Multi-expand mode).

2. **Chỉnh Sửa Trực Tiếp (Inline Editing)**:
   - Các trường `Price`, `Start Date`, `Expiry Date` hiển thị dưới dạng ô Input trực tiếp khi mở rộng.
   - Khi chỉnh sửa và nhấn `Save Changes`:
     - Cập nhật record trong bảng `tours_and_offers`.
     - Gọi dịch vụ re-embedding ngầm (Incremental Re-indexing) cho trường nội dung.
     - Cập nhật cờ `is_active` nếu ngày hiện tại vượt quá `Expiry Date`.

3. **Chỉ Số Trạng Thái (Status Pills)**:
   - `Active` (Safe Emerald): Tour đang mở bán, AI được phép tư vấn.
   - `Expired` (Alert Crimson): Tour đã hết hạn, AI từ chối tư vấn tour này.
