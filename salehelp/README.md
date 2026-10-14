# SaleHelp – AI tự động tư vấn tour trên Zalo

SaleHelp là hệ thống AI tự động tư vấn và chăm sóc khách hàng trên Zalo Web (`chat.zalo.me`), kết hợp giữa một Node.js proxy server cục bộ và Chrome Extension Manifest V3. Hệ thống hỗ trợ nhiều profile nhân vật/kỹ năng (sales tour, công việc, hẹn hò), quản lý kho tri thức tour du lịch và áp dụng cơ chế chống bịa đặt giá/thời lượng nghiêm ngặt.

| Thành phần | Vai trò | Công nghệ |
|---|---|---|
| **Server** (`server.js`) | Proxy gọi Gemini, lưu kho tour / persona / skill, phục vụ trang Dashboard, nhận webhook Zalo OA | Node.js thuần, **không cần `npm install`** |
| **Chrome Extension** (`extension/`) | Chạy trên `chat.zalo.me`: phát hiện tin nhắn mới, nhờ AI soạn câu trả lời và tự gửi | Manifest V3 |

```
 Zalo Web (chat.zalo.me)                       Máy của bạn (localhost:8080)
┌────────────────────────┐   fetch qua        ┌──────────────────────────────┐
│ Extension content.js   │ ─ background.js ─▶ │ server.js                    │
│  • quét tin nhắn mới   │                    │  POST /api/gemini/generate ──┼─▶ Google Gemini
│  • hàng đợi nhiều khách│ ◀───── JSON ────── │  GET  /api/tours|persona|... │
│  • tự điền & gửi       │                    │  tours_config.json           │
└────────────────────────┘                    │  persona_config.json         │
                                              │  skills_config.json          │
 Trình duyệt ──▶ http://localhost:8080 ─────▶ │  web_dist/index.html (Dash)  │
                                              └──────────────────────────────┘
```

---

## Bắt đầu nhanh

Quy trình 5 phút để chạy SaleHelp từ đầu đến cuối:

1. **Kiểm tra môi trường Node.js (yêu cầu Node 18 trở lên):**
   ```bash
   node -v
   ```

2. **Chuyển vào thư mục `salehelp` và khởi động server:**
   ```bash
   cd salehelp
   npm start
   # hoặc: node server.js
   ```
   Khi chạy lần đầu chưa có key, server sẽ in log:
   ```
   🚀 SaleHelp Real Multi-Channel Proxy Server running at http://localhost:8080/
   • Real Gemini AI Proxy: POST http://localhost:8080/api/gemini/generate (Key loaded: No - open the Dashboard > Settings to add one)
   ```
   Key nhập ở bước 3 có hiệu lực ngay, không cần khởi động lại. Dòng log này chỉ in lúc khởi động, nên lần chạy sau sẽ thấy `Key loaded: Yes, source: dashboard`.

3. **Cấu hình Gemini API key trên Dashboard:**
   - Mở trình duyệt truy cập <http://localhost:8080>.
   - Vào tab **Settings** (ở cuối thanh bên trái).
   - Dán Gemini API key (lấy tại <https://aistudio.google.com/apikey>) rồi bấm **Lưu & kiểm tra**. Server gọi thử Google để xác thực key rồi mới lưu.

4. **Thêm dữ liệu tour (cần thiết cho profile mặc định `sales_tour`):**
   - Vào tab **Knowledge** trên Dashboard.
   - Thêm ít nhất 1 tour du lịch và đảm bảo trạng thái kích hoạt (`isActive: true`). Profile mặc định `sales_tour` bắt buộc có kho tour mới tự động trả lời để tránh bịa giá.

5. **Cài đặt Chrome Extension:**
   - Mở Google Chrome (hoặc trình duyệt Chromium hỗ trợ MV3), truy cập `chrome://extensions`.
   - Bật **Developer mode** ở góc trên bên phải.
   - Bấm **Load unpacked** rồi chọn thư mục `salehelp/extension`.
   - *(Tuỳ chọn)* Ghim biểu tượng **SaleHelp** lên thanh công cụ trình duyệt.

6. **Bật tự động trả lời trên Zalo Web:**
   - Truy cập <https://chat.zalo.me> và đăng nhập tài khoản Zalo.
   - Widget SaleHelp sẽ xuất hiện ở góc màn hình. Bật công tắc **Tự động trả lời**.

---

## Build & chạy server

### Không cần bước build

Server **không có bước build**: Node chạy thẳng file `server.js`, không có dependency bên ngoài (không cần chạy `npm install`), và trang Dashboard (`web_dist/index.html`) đã được build sẵn thành một file HTML duy nhất.

### Lấy mã nguồn

```bash
git clone git@github.com:minhkhang0107/SaleHelp.git
cd SaleHelp/salehelp          # đường dẫn có thể khác nếu repo được đặt trong thư mục khác
```

### Cấu hình Gemini API key

API key **không nằm trong source code**. Có 2 cách cung cấp, theo thứ tự ưu tiên:

**Cách 1 (khuyến nghị): Nhập trên Dashboard**
1. Chạy server và mở <http://localhost:8080>.
2. Vào tab **Settings** (cuối thanh bên trái).
3. Dán API key rồi bấm **Lưu & kiểm tra**.

Server gọi thử Google để xác nhận key hợp lệ rồi mới lưu. Key được ghi vào `settings.local.json` (quyền `0600`, đã nằm trong `.gitignore`) và áp dụng ngay cho mọi yêu cầu AI, kể cả extension Zalo, không cần khởi động lại server. Dashboard chỉ hiển thị 4 ký tự cuối của key; server không bao giờ trả key đầy đủ về trình duyệt. Nút **Xóa key** cho phép gỡ bỏ key đã lưu.

**Cách 2 (dự phòng): File `.env`**
```bash
cp .env.example .env     # .env nằm trong .gitignore
```
Nội dung file `.env`:
```env
GEMINI_API_KEY=<API key của bạn>
```
Chỉ được dùng khi chưa có key nhập từ Dashboard. Server **không còn đọc** `.env.example`. File này được theo dõi bởi git nên để trống key.

**Lưu ý:**
- Không bao giờ commit key thật lên git. Đừng dán key vào `.env.example`.
- Có thể gửi key riêng cho từng request qua trường `apiKey` trong body của `/api/gemini/generate`; trường này được ưu tiên cao nhất.
- Biến `GEMINI_PROXY_ENDPOINT` cũ chỉ dùng cho app Flutter, server Node bỏ qua.

### Chạy server

```bash
npm start
# hoặc: node server.js
```

Thấy các dòng sau là server đã sẵn sàng:
```
🚀 SaleHelp Real Multi-Channel Proxy Server running at http://localhost:8080/
• Real Gemini AI Proxy: POST http://localhost:8080/api/gemini/generate (Key loaded: Yes, source: dashboard)
```
`source` là `dashboard` hoặc `env` tuỳ key lấy từ đâu. Dòng `Key loaded: No ...` nghĩa là chưa có key nào. Vào Dashboard > Settings để nhập key.

### Kiểm tra nhanh

```bash
curl http://localhost:8080/api/persona      # trả JSON persona
curl http://localhost:8080/api/tours        # trả danh sách tour
curl -X POST http://localhost:8080/api/gemini/generate \
     -H 'Content-Type: application/json' \
     -d '{"prompt":"Xin chào"}'             # trả về câu trả lời của Gemini
```

- Gọi `/api/gemini/generate` mà nhận lỗi `Chưa có Gemini API key` thì chưa nhập key.
- Nhận lỗi `401 ... invalid authentication credentials` thì key sai hoặc đã bị thu hồi.
- Mở <http://localhost:8080> trên trình duyệt để vào Dashboard.

### Chạy nền và tự khởi động lại

```bash
# Cách đơn giản bằng nohup
nohup node server.js > server.log 2>&1 &

# Hoặc dùng pm2 (khuyến nghị nếu chạy lâu dài)
npm install -g pm2
pm2 start server.js --name salehelp
pm2 logs salehelp
pm2 save && pm2 startup      # tự chạy lại khi khởi động máy
```

### Đổi cổng server

Cổng mặc định là `8080`. Bạn có thể đổi bằng biến môi trường `PORT` (ví dụ `PORT=9090 npm start` hoặc `PORT=9090 node server.js`). Khi đổi cổng, để extension hoạt động bình thường bạn phải sửa đủ **3 nơi**:

1. Biến môi trường `PORT` khi khởi động server (`PORT=...`).
2. `host_permissions` trong file `extension/manifest.json` (hai dòng `localhost:8080` và `127.0.0.1:8080` đổi sang port mới).
3. Ô **Server URL** trong cửa sổ popup của extension (`http://localhost:<PORT>`).

Sau khi sửa cổng, hãy tải lại extension theo hướng dẫn bên dưới.

---

## Cài Chrome Extension

### Cài đặt

1. Mở trình duyệt Chrome, truy cập `chrome://extensions`.
2. Bật công tắc **Developer mode** ở góc trên bên phải.
3. Bấm nút **Load unpacked** rồi chọn thư mục `salehelp/extension`.
4. (Tuỳ chọn) Ghim icon **SaleHelp** lên thanh công cụ trình duyệt.
5. Mở <https://chat.zalo.me> và đăng nhập tài khoản Zalo. Widget SaleHelp sẽ hiển thị nổi trên trang web.

### Tải lại sau khi sửa code

Sau khi chỉnh sửa code trong thư mục `extension/`:
1. Vào `chrome://extensions`, bấm biểu tượng tải lại (reload) tại thẻ tiện ích SaleHelp.
2. **F5 lại tab Zalo Web**. Nếu chỉ tải lại extension mà không F5 tab Zalo thì trang chat vẫn tiếp tục chạy mã nguồn cũ trong bộ nhớ.

### Cấu hình trong popup

Bấm vào biểu tượng SaleHelp trên thanh công cụ Chrome để mở cửa sổ cấu hình:

| Mục | Ý nghĩa |
|---|---|
| Tự động trả lời | Bật/tắt tính năng auto-reply |
| Server URL | Địa chỉ server Node.js (mặc định: `http://localhost:8080`) |
| Độ trễ | Số giây chờ trước khi tự gửi câu trả lời (tạo cảm giác tự nhiên như người thật) |
| **Lưu** | Ghi thông tin cấu hình vào `chrome.storage` |

Popup còn có nút mở nhanh Dashboard, nút mở Zalo Web và một nhãn trạng thái cho biết extension đã kết nối được với server hay chưa.

---

## Sử dụng hằng ngày

### Giao diện widget trên Zalo Web

Widget nổi (có thể kéo thả vị trí tuỳ ý, bấm `_` để thu nhỏ) cung cấp các thông tin và thao tác:

- **Tự động trả lời**: Công tắc bật/tắt chế độ tự động.
- **Skill & Knowledge**: Hiển thị skill đang dùng. Bấm vào để mở nhanh Dashboard chỉnh sửa.
- **Đang chat với**: Tên khách hàng ở cuộc hội thoại đang mở và nội dung tin nhắn mới nhất chưa được trả lời.
- **Hàng đợi (Queue)**: Danh sách những khách hàng khác đang gửi tin nhắn đến nhưng chưa được xử lý.
- **⚡ Trả Lời Người Này**: Ép AI soạn câu trả lời ngay lập tức cho chat đang mở (hoạt động cả khi tắt tự động trả lời).
- **📋 Copy**: Sao chép nhanh nội dung AI vừa soạn thảo vào clipboard để chỉnh sửa hoặc gửi thủ công.
- **Chấm trạng thái**: Màu xanh báo hiệu kết nối server tốt; màu đỏ báo hiệu server chưa chạy hoặc mất kết nối.

### Luồng tự động

1. Mỗi chu kỳ 1,5 giây, extension quét cuộc trò chuyện đang mở. Nếu tin nhắn cuối cùng là của khách hàng và chưa được trả lời, extension lấy lịch sử hội thoại kết hợp kho tour gửi đến Gemini qua server.
2. Extension chờ đủ số giây "độ trễ" đã thiết lập, tự động điền câu trả lời vào khung chat của Zalo và nhấn gửi.
3. Khi có khách hàng khác nhắn tới trong danh sách chat, họ sẽ được đưa vào hàng đợi. Sau khi hoàn thành cuộc trò chuyện hiện tại, extension tự động nhấp chuyển sang khách tiếp theo.

### Xử lý nhiều khách cùng lúc

- Khi đang trả lời khách A mà khách B gửi tin nhắn tới: B sẽ nằm chờ trong hàng đợi, AI phục vụ xong A mới chuyển sang B.
- Nếu khách B phải chờ quá **20 giây**, lượt của A sẽ không được bắt đầu thêm câu trả lời mới mà nhường quyền ưu tiên cho B (quy định bởi hằng số `MAX_QUEUE_WAIT_MS` trong `content.js`).
- Nếu bạn tự dùng chuột nhấp chuyển sang cuộc trò chuyện khác trong lúc AI đang chờ gửi cho khách A, tác vụ gửi cho A sẽ **bị hủy ngay lập tức** (để tránh gửi nhầm nội dung sang người khác) và khách A được đưa trở lại hàng đợi.

### Chọn và chuyển đổi profile

- Bạn có thể chuyển đổi profile linh hoạt ngay trên Dashboard (tab **Profiles**) hoặc gọi API `POST /api/profiles/set-active`.
- Extension tự động đồng bộ sang profile mới sau tối đa ~8 giây mà không cần khởi động lại server hay tải lại trang Zalo.

### Chống bịa thông tin

- Nhiệt độ sinh (`temperature`) không cố định toàn cục mà được cấu hình riêng trong từng profile tại trường `generation.temperature` (mặc định: `sales_tour` đặt 0.2 để giữ câu trả lời chuẩn xác, `work` đặt 0.4, `dating` đặt 0.8 để tự nhiên và linh hoạt hơn).
- Cơ chế kiểm soát giá và thời lượng nghiêm ngặt chỉ kích hoạt khi profile có cấu hình `knowledge.strictGuard: true` (mặc định chỉ có profile `sales_tour` bật cờ này).
- Khi bật `strictGuard`, trước khi gửi câu trả lời, extension tự động quét và đối chiếu mọi **số tiền** cùng **thời lượng (3N2Đ, 4 ngày 3 đêm...)** xuất hiện trong câu trả lời với kho dữ liệu tour. Nếu phát hiện số liệu không khớp, AI được yêu cầu viết lại một lần. Nếu lần hai vẫn sai lệch, extension sẽ hủy bỏ và gửi câu an toàn đã cấu hình trong `replies.handoff` ("em xin phép kiểm tra lại với bộ phận điều hành…"), đồng thời hiển thị cảnh báo trên widget. Nội dung bị chặn được ghi lại chi tiết trong Console của tab Zalo.
- Với profile yêu cầu dữ liệu bắt buộc (`knowledge.required: true` như `sales_tour`), nếu kho tour trống hoặc mọi tour đều ở trạng thái `isActive: false`, extension sẽ từ chối trả lời tự động để tránh bịa đặt thông tin.
- **Giới hạn**: Hệ thống kiểm tra chặt chẽ số tiền và thời lượng, nhưng không tự động phát hiện được việc bịa tên điểm tham quan hoặc các dịch vụ đi kèm ngoài tour.

### Trí nhớ theo từng khách hàng

- Lịch sử hội thoại của từng khách được lưu trữ biệt lập (dựa theo tên hiển thị) trong `chrome.storage` của extension, hoàn toàn không bị nhầm lẫn giữa các khách hàng khác nhau.
- Khi một cuộc hội thoại vượt quá 40 tin nhắn, phần hội thoại cũ sẽ được AI tự động tóm tắt thành các tiêu chí chính (nhu cầu, thời gian, số lượng người, ngân sách, tour quan tâm, đầu việc cần làm, trạng thái) để đưa vào system prompt. 16 tin nhắn gần nhất được giữ nguyên văn. Các ngưỡng này được quy định bởi `SUMMARIZE_THRESHOLD` và `SUMMARIZE_KEEP_RECENT` trong `content.js`.
- Bộ nhớ lưu trữ tối đa thông tin của 200 khách hàng; khách hàng lâu nhất không tương tác sẽ tự động được xoá trước.
- Lưu ý: Trường hợp hai khách hàng có tên hiển thị hoàn toàn trùng nhau thì sẽ dùng chung bộ nhớ.
- Muốn xóa toàn bộ trí nhớ: Vào `chrome://extensions` → SaleHelp → *Details* → *Clear data*, hoặc mở Console của extension và chạy:
  ```javascript
  chrome.storage.local.remove('salehelp_memory');
  ```

### Các tab trên Dashboard (`http://localhost:8080`)

| Tab | Chức năng |
|---|---|
| Chat | Giao diện hộp thư và khung chat thử nghiệm trực tiếp với AI |
| Profiles | Tạo mới (từ mẫu hoặc trống), chỉnh sửa, xoá profile và chọn profile đang kích hoạt |
| Knowledge | Quản lý danh sách tour du lịch, ưu đãi và persona của profile đang kích hoạt |
| Channels | Cấu hình kết nối kênh Zalo OA, Zalo cá nhân, Telegram, Facebook |
| Skills | Tạo và sửa đổi skill, chọn skill đang được kích hoạt |
| Webhooks | Theo dõi luồng sự kiện realtime dạng Server-Sent Events (SSE) |
| Settings | Cấu hình nhập hoặc xoá Gemini API key |

---

## Dữ liệu cho AI

Với các profile có bật kho dữ liệu (mặc định là `sales_tour`), AI **chỉ được phép** cung cấp thông tin về giá, số ngày/đêm và dịch vụ có sẵn trong kho tour. Hãy thêm dữ liệu tour vào hệ thống trước khi bật chế độ tự động trả lời; nếu kho trống, extension sẽ không tự phát sinh câu trả lời. Các profile không sử dụng kho dữ liệu (`work`, `dating`) không cần nhập kho tour.

Dữ liệu có thể chỉnh sửa trực tiếp qua Dashboard (tab **Profiles** cho profile, tab **Knowledge** cho tour và persona, tab **Skills** cho skill) hoặc chỉnh sửa file JSON trong thư mục `salehelp`. Server nạp lại file mỗi khi có yêu cầu nên **không cần khởi động lại server**; extension sẽ tự động cập nhật sau tối đa ~8 giây.

### `profiles_config.json`

Một **profile** là một gói cấu hình AI độc lập hoàn chỉnh. Bạn có thể thiết lập nhiều profile khác nhau và lựa chọn profile hoạt động ngay trên Dashboard (tab **Profiles**) hoặc qua endpoint `POST /api/profiles/set-active`.

Các profile dựng sẵn:

| ID | Dùng cho | Kho tour | Chặn sai giá |
|---|---|---|---|
| `sales_tour` | Tư vấn & chốt đơn tour du lịch (hành vi cũ) | Bật, bắt buộc | Có |
| `work` | Trao đổi công việc chuyên nghiệp với đồng nghiệp/đối tác | Tắt | Không |
| `dating` | Trò chuyện / hẹn hò (thân thiện, tôn trọng, không phủ nhận là AI nếu bị hỏi thẳng) | Tắt | Không |

Cấu trúc file mẫu:

```json
{
  "activeProfileId": "sales_tour",
  "profiles": [
    {
      "id": "work",
      "name": "🧑‍💼 Công Việc",
      "description": "...",
      "persona": { "name": "...", "title": "...", "tone": "..." },
      "skills": [{ "id": "work_assistant", "name": "...", "category": "...", "description": "...", "systemPrompt": "..." }],
      "activeSkillId": "work_assistant",
      "knowledge": { "enabled": false, "required": false, "strictGuard": false },
      "summaryPrompt": "...",
      "replies": { "fallback": "...", "handoff": "..." },
      "generation": { "temperature": 0.4, "topP": 0.9 }
    }
  ]
}
```

Ý nghĩa các trường trong Profile:

| Trường | Ý nghĩa |
|---|---|
| `id` | Định danh profile (2–40 ký tự gồm `a-z`, `0-9`, `_`, `-`), không đổi được sau khi tạo |
| `persona` | Tên / chức danh / giọng điệu AI đóng vai |
| `skills`, `activeSkillId` | Các system prompt của profile và prompt đang dùng. Hỗ trợ placeholder: `{PERSONA_NAME}`, `{PERSONA_TITLE}`, `{PERSONA_TONE}`, `{CUSTOMER_NAME}` |
| `knowledge.enabled` | Nối kho tour vào system prompt |
| `knowledge.required` | Nếu kho trống thì extension từ chối tự động trả lời |
| `knowledge.strictGuard` | Đối chiếu giá / số ngày đêm trong câu trả lời với kho, sai thì viết lại rồi dùng câu `handoff` |
| `summaryPrompt` | Prompt tóm tắt hội thoại cũ của từng người (trí nhớ, mục Sử dụng hằng ngày) |
| `replies.fallback` / `replies.handoff` | Câu dự phòng khi Gemini không trả lời / khi câu trả lời bị chặn |
| `generation` | Cấu hình tham số sinh của model: `temperature` (0–2), `topP` (0–1) |

Lần đầu chạy, nếu chưa có `profiles_config.json`, server tự tạo file này từ 3 mẫu trên; profile `sales_tour` lấy persona và skill từ `persona_config.json` / `skills_config.json` cũ. File hỏng (JSON sai) thì server báo lỗi chứ không ghi đè. Không xóa được profile đang dùng hoặc profile cuối cùng.

### `tours_config.json`

File lưu trữ kho thông tin tour du lịch mà AI được phép sử dụng:

```json
[
  {
    "id": "tour-1",
    "title": "Tour Đà Nẵng - Hội An - Bà Nà Hills 3N2Đ",
    "price": "5,990,000 VNĐ",
    "expiryDate": "2026-09-30",
    "content": "Trọn gói vé máy bay khứ hồi + Khách sạn 4 sao ...",
    "isActive": true
  }
]
```

| Trường | Ý nghĩa |
|---|---|
| `title` | Tên tour. Ghi rõ thời lượng dạng `3N2Đ` hoặc `3 ngày 2 đêm` |
| `price` | Giá hiển thị. Nên ghi đủ số, ví dụ `5,990,000 VNĐ` |
| `content` | Mô tả dịch vụ trọn gói, **mọi thứ AI được phép nói** |
| `expiryDate` | Hạn ưu đãi (chỉ để hiển thị cho AI) |
| `isActive` | `false` thì tour bị ẩn khỏi AI |

Số tiền và thời lượng AI nói ra được đối chiếu với kho này khi profile bật `knowledge.strictGuard`. Nếu không khớp, câu trả lời bị chặn.

### Persona và skill

Persona và skill nằm trong từng profile. Form Persona (tab Knowledge), tab Skills và các API `/api/persona*`, `/api/skills*` luôn đọc/ghi **profile đang dùng**. `persona_config.json` / `skills_config.json` không còn được đọc sau lần chuyển đổi đầu tiên.

> **Lưu ý về Git:** Các file `*_config.json` đang được theo dõi bởi git. Mỗi lần sửa qua Dashboard, file thay đổi và hiện trong `git status`.

---

## Tham khảo

### Cấu trúc thư mục

```
salehelp/
├── server.js                  # Server Node.js (port 8080)
├── .env.example               # Mẫu .env (tuỳ chọn, để trống key)
├── settings.local.json        # (tự tạo) API key nhập từ Dashboard, KHÔNG nằm trong git
├── tours_config.json          # Kho tour (nguồn dữ liệu AI được phép dùng)
├── profiles_config.json       # Các profile AI (persona + skill + cách trả lời) và profile đang dùng
├── profile_store.js           # Đọc/ghi/kiểm tra profiles_config.json
├── persona_config.json        # (cũ) chỉ dùng để chuyển đổi sang profiles_config.json lần đầu
├── skills_config.json         # (cũ) chỉ dùng để chuyển đổi sang profiles_config.json lần đầu
├── package.json               # npm start / npm test / npm run lint (không có dependency)
├── test/                      # Test tự động (node:test)
├── web_dist/index.html        # Dashboard quản trị (1 file HTML, build sẵn)
├── extension/                 # Chrome extension
│   ├── manifest.json
│   ├── content.js             # Logic chính trên Zalo Web
│   ├── profile_prompt.js      # Dựng system prompt / tham số AI từ profile đang dùng
│   ├── background.js          # Gọi API server hộ content script
│   ├── popup.html / popup.js  # Cửa sổ cấu hình khi bấm icon extension
│   └── styles.css             # Giao diện widget nổi
└── test_zalo_oa_pure_web.js   # Test logic Zalo OA (PKCE, HMAC, refresh token)
```

### API của server

Tất cả các endpoint đều trả về dữ liệu định dạng JSON. CORS được mở cho toàn bộ origin (`*`), cho phép extension và Dashboard gọi được từ mọi origin.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/settings` | Trạng thái API key: đã cấu hình chưa, 4 ký tự cuối, nguồn (`dashboard`/`env`). **Không trả key đầy đủ** |
| POST | `/api/settings/save` | Lưu key: body `{"geminiApiKey":"..."}`, kiểm tra với Google trước khi lưu; gửi chuỗi rỗng để xóa. Chỉ nhận request từ Dashboard/extension (chặn `Origin` lạ) |
| POST | `/api/gemini/generate` | Gọi Gemini. Body: `prompt`, `history[{role,text}]`, `systemInstruction`, `model`, `generationConfig`, `apiKey` (tuỳ chọn). Tự thử nhiều model dự phòng nếu model chính lỗi |
| GET | `/api/tours` · POST `/api/tours/save` | Đọc / ghi kho tour |
| GET | `/api/profiles` | `{ activeProfileId, profiles }` |
| GET | `/api/profiles/active` | Profile đang dùng (extension đọc endpoint này) |
| GET | `/api/profiles/templates` | 3 profile mẫu |
| POST | `/api/profiles/save` | Tạo / cập nhật profile (body = profile). Sai dữ liệu trả 400 kèm `errors[]` |
| POST | `/api/profiles/set-active` | Đổi profile đang dùng: `{"profileId":"dating"}` |
| POST | `/api/profiles/delete` | Xóa profile: `{"profileId":"..."}`. 409 nếu là profile đang dùng hoặc profile cuối |
| GET | `/api/persona` · POST `/api/persona/save` | Đọc / ghi persona của profile đang dùng |
| GET | `/api/skills` · `/api/skills/active` | Danh sách skill / skill đang bật của profile đang dùng (`/active` kèm `profileId`, `profileName`) |
| POST | `/api/skills/save` · `/api/skills/set-active` | Lưu skill / đổi skill đang bật của profile đang dùng |
| GET | `/api/events` | Luồng SSE realtime (log hành động, webhook, `profile_changed`) |
| POST | `/webhook/zalo` (hoặc `/api/webhook/zalo`) | Nhận webhook Zalo OA, đẩy ra SSE. Hiện **chưa xác thực** chữ ký `X-ZEvent-Signature` |
| POST | `/api/zalo/oauth/token` | Đổi `code` lấy access token Zalo OA (PKCE) |
| POST | `/api/zalo/message` | Gửi tin qua Zalo OA (`userId`, `text`, `accessToken`) |
| POST | `/api/telegram/send` | Gửi tin Telegram (`botToken`, `chatId`, `text`) |
| POST | `/api/facebook/send` | Gửi tin Messenger (`pageToken`, `recipientId`, `text`) |
| GET | `/*` | File tĩnh trong `web_dist/` |

### Kiểm thử

```bash
npm test                     # profile store, API profiles của server, dựng prompt của extension
npm run lint                 # kiểm tra cú pháp server.js, profile_store.js, extension/*.js
node test_zalo_oa_pure_web.js
```

`npm test` chạy server trong thư mục tạm (`SALEHELP_DATA_DIR`) nên không sửa file trong repo. `test_zalo_oa_pure_web.js` chạy 4 test logic Zalo OA (PKCE, chữ ký HMAC-SHA256, định tuyến nhiều OA, làm mới token), không cần mạng. Phần thao tác DOM trên Zalo Web của extension chưa có test tự động; kiểm tra bằng cách mở Zalo Web và xem Console (`F12`), log của extension bắt đầu bằng `[SaleHelp]`.

### Bảo mật

Server được viết để chạy **trên máy cá nhân**, và hiện:

- Lắng nghe trên **mọi giao diện mạng** (`0.0.0.0`), không chỉ localhost.
- Không có xác thực. Ai truy cập được cổng 8080 đều đọc/sửa được kho tour, profile (persona, skill) và **dùng API key Gemini của bạn** qua `/api/gemini/generate`.
- CORS `*` cho phép mọi trang web gọi vào server.

Vì vậy: **không mở cổng 8080 ra internet**, không đưa lên VPS khi chưa thêm xác thực và giới hạn địa chỉ lắng nghe (`server.listen(PORT, '127.0.0.1')`). Nếu cần truy cập từ xa, đặt sau reverse proxy có xác thực (Nginx + Basic Auth, Cloudflare Access, Tailscale…).

Về API key:
- Key nằm trong `settings.local.json` (quyền `0600`, bị git bỏ qua), không nằm trong source. Hai endpoint `/api/settings*` từ chối request mang `Origin` của trang web lạ, nhưng vì server không có xác thực nên **ai truy cập được cổng 8080 vẫn có thể đặt lại key hoặc dùng key đó để gọi Gemini**. Giữ server ở localhost.
- `.env.example` là file được theo dõi bởi git, không được chứa key thật. Nếu từng commit key vào đó, hãy **thu hồi (revoke) key ở Google AI Studio và tạo key mới**, vì sửa hoặc xóa file không xóa khỏi lịch sử git.

### Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp / cách xử lý |
|---|---|
| Widget báo "Chưa bật SaleHelp Server" | Server chưa chạy hoặc sai Server URL. Chạy `npm start` (hoặc `node server.js`), kiểm tra `curl localhost:8080/api/persona` |
| `EADDRINUSE: address already in use :::8080` | Cổng bị chiếm. Tìm bằng `ss -ltnp \| grep 8080` rồi tắt tiến trình đó |
| `Key loaded: No` hoặc lỗi `Chưa có Gemini API key` | Chưa nhập key. Vào Dashboard > Settings, hoặc đặt `GEMINI_API_KEY=...` trong `.env` |
| Settings báo "Google từ chối key này" | Key sai, hết hạn hoặc bị thu hồi. Tạo key mới tại aistudio.google.com/apikey |
| Settings báo `Forbidden origin` (403) | Đang mở Dashboard qua địa chỉ khác với địa chỉ server (ví dụ qua proxy đổi Host). Truy cập trực tiếp `http://localhost:8080` |
| Gemini trả 401 / 403 | Key sai, hết hạn hoặc bị thu hồi. Nhập key mới ở Settings |
| Widget không hiện trên Zalo | Chưa F5 sau khi tải lại extension, hoặc extension chưa bật. Xem Console có dòng `[SaleHelp] AI Co-Pilot ... Loaded` không |
| Có tin mới nhưng không tự click sang chat khác | Mở Console, tìm dòng `📥 Đã thêm [...] vào Hàng đợi`. Không có thì selector badge chưa đọc của Zalo không khớp, cần chỉnh `scanSidebarForIncomingUsers` trong `content.js`. Có thì xem cảnh báo `Chưa chuyển/nạp xong chat` |
| AI không trả lời, widget báo "Chưa có dữ liệu tour" | Profile đang dùng bắt buộc kho dữ liệu nhưng kho tour trống hoặc mọi tour đều `isActive: false`. Nhập tour hoặc đổi sang profile tắt kho dữ liệu |
| Widget báo "Chưa tải được profile từ server" | Server chưa chạy hoặc `profiles_config.json` bị lỗi JSON (xem log server / `curl localhost:8080/api/profiles/active`) |
| Đổi profile nhưng AI vẫn trả lời kiểu cũ | Chờ ~8 giây để extension đồng bộ, hoặc F5 tab Zalo |
| Câu trả lời luôn là "xin phép kiểm tra lại…" | Giá/thời lượng AI nói không khớp kho. Xem log `Câu trả lời lần 1 bị chặn` trong Console; kiểm tra định dạng `price` / `title` trong kho |
| Thêm tour trong Dashboard nhưng AI chưa biết | Chờ ~8 giây để extension đồng bộ, hoặc F5 tab Zalo |
| Sau khi tải lại extension, tab Zalo lỗi `Extension context invalidated` | Bình thường. F5 tab Zalo |

---

## Phát triển app Flutter (tuỳ chọn)

Thư mục `app/`, `data/`, `domain/`, `shared/`, `init/`, `resources/` là app Flutter đa module quản lý bằng melos. Không cần cho server hay extension.

### Yêu cầu
- Dart 3.6.0, Flutter SDK 3.27.1, melos 6.3.0
- gradle 8.9 và AGP 8.5.0

### Cài đặt

```bash
dart pub global activate melos 6.3.0    # bỏ qua nếu đã cài
gem install lefthook                    # tuỳ chọn
```

Thêm vào `~/.zshrc` hoặc `~/.bashrc`:

```bash
export PATH="$PATH:<path to flutter>/flutter/bin"
export PATH="$PATH:<path to flutter>/flutter/bin/cache/dart-sdk/bin"
export PATH="$PATH:~/.pub-cache/bin"
```

### Cấu hình và chạy

```bash
make gen_env     # sinh file env cho các flavor
make sync        # melos bootstrap + l10n + build_runner
make run_dev     # chạy flavor develop (cũng có run_qa, run_stg, run_prod)
make test        # chạy toàn bộ test
make lint        # analyze + metrics
```

---

## Giấy phép

MIT
