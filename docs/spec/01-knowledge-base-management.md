# 01 - Phân Hệ Quản Lý Tri Thức & Persona (Knowledge Base & Persona)

## 1. Mục Đích
Trang màn hình riêng biệt (nằm trong mục Settings, truy cập từ Sidebar) cho phép quản lý thông tin đóng vai của AI (Persona) và kho dữ liệu Tour du lịch, Ưu đãi dưới dạng danh sách mở rộng (Accordion).

## 2. Giao Diện & Thành Phần (UI Components)

### Thanh Điều Hướng Tổng Thể (Global Navigation Sidebar)
- Thanh chiều rộng `80px` cố định bên trái, màu nền `#18181B`.
- Icon `Knowledge Base` được Highlight với màu **Sapphire Accent (`#2563EB`)**.

### Khối 1: Cấu Hình Persona Roleplay (Top Form Card)
- **Form Card**: Khung cấu hình đóng vai cho AI.
- **Các trường dữ liệu**:
  - `Agent Name`: Tên nhân viên hiển thị (vd: Nguyễn Văn A).
  - `Job Title / Experience`: Chức danh và kinh nghiệm (vd: Chuyên viên tư vấn Tour Chuyên nghiệp, 5 năm kinh nghiệm).
  - `Tone of Voice`: Giọng điệu tư vấn (vd: Lịch sự, nhiệt tình, xưng em gọi anh/chị).
- **Nút bấm**: `Save Persona` (Sapphire Accent fill).

### Khối 2: Kho Dữ Liệu Tour & Khuyến Mãi (Accordion List)
Danh sách các Tour du lịch và Ưu đãi được hiển thị dưới dạng **Hàng ngang Accordion**:

1. **Trạng Thái Thu Gọn (Collapsed Row)**:
   - `Title`: Tên Tour / Chương trình ưu đãi (vd: Tour Đà Nẵng - Hội An 3N2Đ).
   - `Price`: Mức giá hiển thị (vd: 5,990,000 VNĐ).
   - `Start Date`: Ngày bắt đầu khởi hành/áp dụng.
   - `Expiry Date`: Ngày hết hạn đăng ký.
   - `Status Badge`: Nhãn `Active` (Màu Safe Emerald `#16A34A`).

2. **Trạng Thái Mở Rộng (Expanded Row)**:
   - `Content`: Chi tiết lịch trình, dịch vụ bao gồm.
   - `Editable Inputs`: Các ô input để sửa nhanh `Price`, `Start Date`, `Expiry Date`.
   - `Action Buttons`: Nút `Save Changes` (Sapphire Accent fill) và Nút `Delete` (Alert Crimson outline `#DC2626`).

## 3. Quy Trình Dữ Liệu (Data Handling)
- Khi ấn `Save Changes` trên một hàng Tour, hệ thống tự động cập nhật Database và tính toán lại Vector Embedding cho Tour đó.
- Khi AI nhận câu hỏi từ khách hàng, AI sẽ tìm kiếm Tour phù hợp trong cơ sở dữ liệu này kết hợp với `Persona Settings` để sinh ra câu trả lời cá nhân hóa.
