# 00 - Tổng Quan Hệ Thống (Overview)

## 1. Tên Dự Án
**Social QA Auto-Responder (Web AI Bot)**

## 2. Mục Tiêu (Objective)
Xây dựng một nền tảng Web App (SaaS-like) cho phép cá nhân và doanh nghiệp:
1. **Quản lý Tri Thức (Knowledge Base)**: Tải lên các tệp tài liệu (PDF, Word, Excel, TXT, CSV). AI sẽ tự động phân tích và cấu trúc lại thành một Cây Danh Mục Chỉ Mục (Category Index Tree).
2. **Chỉnh Sửa Trực Tiếp (Direct Web Editor)**: Giao diện cho phép người dùng trực tiếp sửa đổi, thêm bớt nội dung, câu hỏi FAQ ngay trên nền web, đảm bảo AI trả lời theo đúng ý muốn.
3. **Tự Động Phản Hồi Đa Kênh (Omnichannel Auto-Responder)**: Tích hợp Zalo OA, Facebook Messenger, Telegram để tự động trả lời khách hàng dựa trên Kho tri thức (RAG - Retrieval-Augmented Generation).
4. **Kiểm Soát Chat (Human Takeover)**: Theo dõi lịch sử chat, đánh giá độ tin cậy của câu trả lời AI (Confidence Score), và cho phép nhân viên vào chat trực tiếp khi AI không chắc chắn.

## 3. Kiến Trúc Tổng Thể (High-Level Architecture)
Hệ thống được chia thành 4 phân hệ chính:
1. **Web Dashboard & Editor**: Frontend quản lý.
2. **AI Categorizer & Indexing Engine**: Phân tích tài liệu, bóc tách chunks và tạo danh mục, lưu trữ Vector DB (`pgvector`).
3. **Webhook Gateway & Async Queue**: Nhận sự kiện từ Zalo/FB/Telegram, phản hồi 200 OK ngay lập tức, đẩy logic vào Redis Queue.
4. **LLM RAG Engine**: Retrieval tìm kiếm ngữ cảnh, sinh câu trả lời bằng Gemini/GPT, kiểm tra Threshold chặn ảo giác (hallucination).

## 4. Tech Stack Đề Xuất
- **Frontend**: Next.js, TailwindCSS, React-Treeview, Tiptap (Rich Text Editor).
- **Backend API & Webhook**: Node.js (NestJS / Express) hoặc Python (FastAPI).
- **Database**: PostgreSQL (Relational data) + `pgvector` extension (Vector embeddings).
- **Queue System**: Redis + BullMQ (hoặc Celery).
- **AI Models**: 
  - Tách & Phân loại: Gemini 1.5 Flash (Structured JSON Mode).
  - Trả lời chat (LLM): Gemini 1.5 Flash / OpenAI GPT-4o-mini.
  - Embedding: text-embedding-3-small (OpenAI) hoặc Gemini Embedding.
