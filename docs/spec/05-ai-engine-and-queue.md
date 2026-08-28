# 05 - Engine Xử Lý AI, Hàng Đợi & RAG (AI Engine & Async Queue)

## 1. Mục Đích
Là não bộ xử lý ngầm của hệ thống, chịu trách nhiệm tìm kiếm tri thức (Tour/Ưu đãi), lồng ghép Persona đóng vai, và gọi LLM tạo câu trả lời cá nhân hóa mà không bị ảo giác (Hallucination).

## 2. Kiến Trúc Luồng Xử Lý (Data Flow)
1. **Webhook Receiver**: Nhận Payload từ Zalo/Meta -> Đẩy vào Redis Queue -> Trả về HTTP 200 OK ngay lập tức.
2. **Message Worker**: Lấy tin nhắn từ Queue, làm sạch text và tạo Vector Query (Embedding API).
3. **Hybrid Retrieval**:
   - Truy vấn `pgvector` lấy các Tour / Ưu đãi có `cosine_similarity` cao nhất.
   - Lọc bỏ các Tour đã hết hạn (`Expiry Date < Current Date`).
4. **Persona & Context Prompt Assembly**:
   - Đọc `Persona Settings` (Tên, Chức danh, Giọng điệu).
   - Lắp ráp System Prompt:
     ```text
     Bạn là [Agent Name], [Job Title]. Hãy đóng vai nhân viên tư vấn du lịch với giọng điệu [Tone of Voice].
     Dưới đây là thông tin Tour/Ưu đãi tìm được:
     {CONTEXT}
     
     Hãy trả lời khách hàng dựa TRÊN CONTEXT NÀY. Nếu không có thông tin, hãy thông báo lịch sự.
     ```
5. **LLM Generation & Guardrail**:
   - Tính toán Confidence Score.
   - Nếu Score < 0.70: Gửi tin nhắn Fallback và gắn cờ cảnh báo trên Chat Dashboard để Nhân viên Takeover.
   - Gửi tin nhắn phản hồi tới khách qua Zalo/Meta API.
