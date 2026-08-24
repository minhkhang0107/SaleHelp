# 00 - Tổng Quan Dự Án (Social QA Auto-Responder - Tourism Edition)

## 1. Giới Thiệu
Dự án **Social QA Auto-Responder** là hệ thống trả lời tự động tích hợp đa kênh (Zalo OA, Facebook Messenger, Telegram) được tùy chỉnh chuyên biệt cho **ngành Du lịch & Dịch vụ**. Hệ thống sử dụng công nghệ LLM (RAG) kết hợp với **Persona Roleplay** (Đóng vai theo thông tin cá nhân) để cung cấp tư vấn tự nhiên, cá nhân hóa cho khách hàng về các Tour, Ưu đãi, và Lịch trình.

## 2. Bài Toán Cốt Lõi
1. **Unified Workspace**: Nhân viên sale không cần mở nhiều tab. Chat, Quản lý Tour, và Thông tin cá nhân (Persona) được gộp chung vào một màn hình duy nhất.
2. **Structured Tourism Data**: Khác với RAG thông thường (chỉ là text), tri thức ở đây được cấu trúc hóa mạnh mẽ thành các Tour/Ưu đãi với các thông số: Giá tiền, Ngày bắt đầu, Ngày kết thúc.
3. **Persona Roleplay**: AI không chỉ đọc dữ liệu mà còn "nhập vai". Nhân viên cấu hình thông tin cá nhân (tên, kinh nghiệm, giọng điệu), AI sẽ mạo danh nhân viên đó để nói chuyện với khách hàng, tạo cảm giác thân thiện và đáng tin cậy.

## 3. Kiến Trúc Tổng Thể (High-Level Architecture)
- **Frontend**: Giao diện Web App tối giản, chuyên nghiệp kiểu Cockpit, tập trung quản lý hội thoại đa kênh và tri thức dạng mở rộng (Accordion).
- **Core AI / RAG Engine**: Xử lý dữ liệu đa chiều (Văn bản + Siêu dữ liệu như Ngày/Giá), nhúng vào Vector Database (PostgreSQL + `pgvector`), prompt injection kết hợp Persona.
- **Message Broker & Workers**: Redis Queue / BullMQ để đảm bảo thời gian phản hồi cực nhanh (chống timeout Webhook từ Meta/Zalo).

## 4. Công Nghệ Sử Dụng (Dự Kiến)
- **Frontend**: React (Vite / Next.js) + Tailwind CSS (Style Clinical).
- **Backend**: Node.js / Python (FastAPI).
- **Database**: PostgreSQL (với extension `pgvector` lưu trữ Embedding) + Redis.
- **LLM**: Gemini Flash (hoặc OpenAI).
