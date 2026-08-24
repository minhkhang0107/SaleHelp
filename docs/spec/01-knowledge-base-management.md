# 01 - Phân Hệ Quản Lý Tri Thức & Persona (Dedicated Page)

## 1. Mục Đích
Trang màn hình riêng biệt (nằm trong Menu Settings / Navigation Sidebar) dùng để quản lý toàn bộ Kho Dữ Liệu Du Lịch (Tour, Ưu đãi, Khuyến mãi) và Cấu Hình Persona (Đóng vai) cho AI.

## 2. Cấu Trúc Giao Diện (Page Layout)
Giao diện bao gồm thanh **Global Navigation Menu** ở cạnh trái, phần nội dung chính được chia thành 2 phân khu lớn:

### Phân Khu 1: Cấu Hình Persona (AI Roleplay Settings)
- Cho phép người dùng nhập thông tin cá nhân/nhân viên để AI giả lập phong cách tư vấn:
  - `Tên hiển thị` (vd: Nguyễn Văn A - NVKD).
  - `Chức danh / Kinh nghiệm` (vd: Chuyên viên tư vấn Tour Chuyên nghiệp, 5 năm kinh nghiệm).
  - `Giọng điệu (Tone of Voice)` (vd: Thân thiện, lịch sự, tư vấn chi tiết, xưng em/gọi anh chị).

### Phân Khu 2: Kho Dữ Liệu Tour & Khuyến Mãi (Accordion List)
Dữ liệu hiển thị dạng **Danh sách hàng ngang có thể mở rộng (Accordion Rows)**:
- **Trạng thái Thu gọn (Collapsed)**:
  - Hiển thị: `Tên Tour / Ưu đãi`, `Giá tiền`, `Ngày khởi hành / Hạn chót`, Nhãn `Trạng thái` (Còn hiệu lực / Hết hạn).
- **Trạng thái Mở rộng (Expanded)**:
  - Chi tiết lịch trình / mô tả nội dung.
  - Trường chỉnh sửa nhanh: `Giá tiền`, `Ngày bắt đầu`, `Ngày hết hạn`.
  - Các thao tác: Nút `Lưu chỉnh sửa`, Nút `Xóa`, Nút `Kích hoạt / Tạm dừng`.

## 3. Mô Hình Dữ Liệu (Data Fields)
- `id`: Unique ID.
- `title`: Tên Tour / Chương trình khuyến mãi.
- `content`: Chi tiết lịch trình, điều kiện áp dụng.
- `price`: Mức giá niêm yết/khuyến mãi.
- `start_date`: Ngày bắt đầu hiệu lực.
- `expiry_date`: Ngày kết thúc / Hạn chót đăng ký.
- `is_active`: Trạng thái áp dụng cho AI tư vấn.
