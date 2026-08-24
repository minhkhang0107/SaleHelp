# 05 - Engine Xử Lý AI, Hàng Đợi & RAG (AI Engine & Async Queue)

## 1. Mục Đích
Là não bộ của toàn hệ thống, chịu trách nhiệm tìm kiếm ngữ cảnh đúng và gọi LLM tạo ra câu trả lời chuẩn xác (không bị Ảo Giác - Hallucination), xử lý ngầm (background task).

## 2. Kiến Trúc Luồng (Data Flow)
1. Message Worker lấy tin nhắn từ Redis Queue.
2. Tiền xử lý (Xóa emoji rác, chuẩn hóa text) và nhúng câu hỏi thành câu Query Vector (bằng Embedding API).
3. **Retrieval**:
   - Truy vấn `pgvector` lấy top `K` (vd: top 5) đoạn tri thức có `cosine_similarity` cao nhất.
   - Tính toán Score. 
4. **Threshold Guardrail (Phòng thủ Ảo giác)**:
   - Nếu top 1 Score < `0.70` (Ngưỡng có thể cấu hình): 
     - Gửi tin nhắn Fallback: "Dạ, vấn đề này em chưa có thông tin. Shop sẽ phản hồi bạn ngay nhé ạ."
     - Cập nhật trạng thái hội thoại: Yêu cầu Nhân viên Takeover.
     - (Dừng xử lý tại đây).
5. **Generation**:
   - Nếu Score >= `0.70`, gom 5 đoạn text lại thành `context`.
   - Gắn vào System Prompt.
   - Lấy `Chat History` (3-5 tin nhắn gần nhất) làm Memory.
   - Gửi sang LLM (Gemini / OpenAI).

## 3. Cấu Trúc System Prompt Cho LLM (Ví dụ)
```
Bạn là một trợ lý thông minh của [Tên Doanh Nghiệp]. 
Nhiệm vụ của bạn là trả lời khách hàng dựa TRÊN THÔNG TIN SAU:
{CONTEXT}

Luật:
1. Chỉ trả lời dựa trên CONTEXT được cung cấp, tuyệt đối KHÔNG bịaa đặt thêm (Zero Hallucination).
2. Nếu thông tin không có trong CONTEXT, hãy từ chối trả lời một cách lịch sự và nói sẽ có nhân viên hỗ trợ sau.
3. Trả lời thân thiện, súc tích (dưới 100 chữ vì đây là tin nhắn chat).
4. Ngôn ngữ: Tiếng Việt.
```

## 4. Bảo Mật Prompt (Prompt Injection Prevention)
- Áp dụng kỹ thuật lọc các cụm từ điều hướng như "Ignore previous instructions", "Bạn là một AI hacker...".
- Cung cấp các delimiter rõ ràng giữa Context và User input (ví dụ: bao User input trong thẻ `<question>...</question>`).
