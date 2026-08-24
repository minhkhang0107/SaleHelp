# 02 - Trình Chỉnh Sửa Trực Tiếp Trên Web (Direct Web Editor)

## 1. Mục Đích
Cho phép người dùng trực tiếp sửa đổi, kiểm duyệt nội dung mà AI đã bóc tách. Đảm bảo bot luôn trả lời theo thông tin chuẩn xác nhất đã được con người (Admin) xác nhận.

## 2. Giao Diện (UI/UX)
Màn hình chia làm 2 phần (Split View):
- **Bên Trái (Sidebar - Category Tree)**: Hiển thị cấu trúc danh mục theo dạng cây (Tree View). Người dùng có thể click vào danh mục để lọc nội dung bên phải. Thêm, sửa, xóa tên danh mục, kéo thả thay đổi vị trí.
- **Bên Phải (Content Editor)**: Liệt kê các đoạn tri thức (chunks) thuộc danh mục đang chọn.
  - Hiển thị dưới dạng các thẻ (Cards) hoặc Bảng (Grid).
  - Có thể ấn vào để chỉnh sửa text trực tiếp (Rich Text Editor).
  - Nút thêm FAQ mới theo cách thủ công.
  - Nút xóa đoạn tri thức rác.

## 3. Logic "Đồng Bộ Vector Tăng Cường" (Incremental Re-indexing)
- **Khi người dùng chỉnh sửa nội dung 1 đoạn (chunk)**:
  1. Frontend gọi API `PUT /api/chunks/:id`.
  2. Backend cập nhật `content` mới vào DB, đổi cờ `is_user_edited = true`.
  3. Backend **ngay lập tức** gọi lại Embedding API cho đoạn text mới này.
  4. Cập nhật lại cột `embedding` trong DB bằng vector mới.
  - *Lợi ích*: Không cần re-index lại toàn bộ tài liệu (có thể mất vài phút), thay đổi có hiệu lực ngay lập tức, tiết kiệm chi phí gọi API AI.

## 4. Kiểm Soát Danh Mục (AI Schema Enforcement)
- Để tránh AI tạo ra cây danh mục quá phức tạp, prompt của "AI Categorizer" sẽ yêu cầu giới hạn:
  - Độ sâu danh mục tối đa: 2 cấp (Main Category -> Sub Category).
  - Khuyến khích gom nhóm các chủ đề nhỏ lẻ thành chủ đề chung (Ví dụ: "Hỗ trợ khách hàng").
