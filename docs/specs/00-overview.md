# 00 - Tổng Quan Dự Án (Social QA Auto-Responder - Tourism Edition)

## 1. Giới Thiệu
Dự án **Social QA Auto-Responder** là giải pháp phần mềm tự động hóa phản hồi khách hàng đa kênh (Zalo OA, Facebook Messenger, Telegram), được tùy chỉnh chuyên biệt cho **ngành Du lịch, Tour & Khuyến mãi**. Hệ thống kết hợp công nghệ **RAG (Retrieval-Augmented Generation)** và **Persona Roleplay** giúp AI tự động tư vấn lịch trình, giá bán, hạn chót ưu đãi theo đúng phong cách nói chuyện của từng nhân viên sale.

## 2. Các Phân Hệ Màn Hình Cốt Lõi (Core UI Modules)

Hệ thống được thiết kế theo phong cách **Cockpit Data-Dense** tối giản, chuyên nghiệp với thanh **Global Navigation Sidebar (80px)** cố định ở bên trái cho phép chuyển đổi tức thì giữa 3 phân hệ:

1. **Màn Hình Chat Dashboard & Human Takeover** (`04-chat-dashboard.md`):
   - Bố cục 3 cột (20% Inbox - 50% Khung Chat - 30% Control Panel).
   - Gắn nhãn **Confidence Score** trên mỗi tin nhắn của AI.
   - Công tắc **Human Takeover** nổi bật giúp nhân viên giành quyền chat bất cứ lúc nào.

2. **Màn Hình Quản Lý Tri Thức & Persona (Settings Page)** (`01-knowledge-base-management.md`):
   - Trang riêng biệt quản lý dữ liệu Tour / Ưu đãi theo mô hình **Accordion List (Hàng ngang thu gọn / mở rộng)**.
   - Quản lý thông tin **Persona Roleplay** (Tên nhân viên, kinh nghiệm, giọng điệu) để AI giả lập phong cách tư vấn.

3. **Màn Hình Tích Hợp Kênh (Settings Page)** (`03-channel-integration.md`):
   - Danh sách các nền tảng chat (Zalo OA, Messenger, Telegram).
   - Quản lý trạng thái kết nối với các nút `Authorize`, `Connected`, và `Disconnect`.

## 3. Kiến Trúc Kỹ Thuật (Technical Architecture)
- **Frontend**: Single Page Application (SPA), Vanilla CSS / Tailwind với hệ màu Clinical (Charcoal `#18181B`, Sapphire Accent `#2563EB`, Whisper Border `rgba(226,232,240,0.5)`).
- **Backend API**: Node.js / Python FastAPI.
- **Data & Vector Store**: PostgreSQL với extension `pgvector` để lưu trữ Embeddings của các Tour & Ưu đãi.
- **Async Queue**: Redis / BullMQ xử lý Webhook bất đồng bộ (tránh timeout 2s từ Zalo/Meta).
