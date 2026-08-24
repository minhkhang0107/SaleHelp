# 01 - Phân Hệ Quản Lý & Xử Lý Tri Thức (Knowledge Base Management)

## 1. Mục Đích
Cho phép người dùng upload tài liệu thô, hệ thống xử lý để bóc tách thành các đơn vị tri thức nhỏ (chunks) và nhúng (embedding) vào Vector Database.

## 2. Tính Năng & Luồng Hoạt Động (User Flow)
1. **Upload Tài Liệu**:
   - Giao diện kéo thả tệp (Drag & Drop).
   - Hỗ trợ định dạng: `.pdf`, `.docx`, `.txt`, `.csv`, `.xlsx`.
   - Lưu trữ tệp gốc vào Storage (AWS S3, Google Cloud Storage, hoặc Local disk).

2. **AI Document Categorizer (Tự Động Tạo Cây Danh Mục)**:
   - Hệ thống đọc tệp, gửi toàn bộ (hoặc từng phần nếu tệp lớn) qua LLM (Gemini Flash) với prompt yêu cầu bóc tách cấu trúc tài liệu.
   - LLM trả về JSON Schema gồm:
     - Tên danh mục (ví dụ: *Quy định chung*, *Hướng dẫn sử dụng*, *Bảng giá*).
     - Gắn kết các đoạn văn bản (chunks) vào các danh mục tương ứng.

3. **Xử Lý Text & Chunking**:
   - Sử dụng thuật toán cắt văn bản thông minh (Recursive Character Text Splitter).
   - Đảm bảo mỗi chunk bảo toàn được ngữ nghĩa (không bị cắt lửng câu).

4. **Embedding & Vector Storage**:
   - Gọi API nhúng (Embedding Model) để chuyển đổi mỗi chunk thành một vector số.
   - Lưu trữ vào bảng `knowledge_chunks` trong PostgreSQL (sử dụng kiểu dữ liệu `vector`).

## 3. Cấu Trúc Dữ Liệu Đề Xuất (Database)
- Bảng `documents`: Lịch sử các tệp đã tải lên.
- Bảng `categories`: Lưu cấu trúc Cây Danh Mục (Nested structure: `parent_id`, `name`).
- Bảng `knowledge_chunks`:
  - `id`: PK
  - `document_id`: FK
  - `category_id`: FK
  - `content`: text
  - `embedding`: vector
  - `is_user_edited`: boolean (Mặc định `false`)
  - `metadata`: JSONB (lưu trang PDF, vị trí dòng, v.v.)
