# SaleHelp – AI tự động tư vấn tour trên Zalo

SaleHelp gồm hai phần chạy cùng nhau:

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

## 1. Yêu cầu

- **Node.js 18 trở lên** (đã thử với v24). Kiểm tra: `node -v`
- **Google Chrome** (hoặc trình duyệt Chromium hỗ trợ extension MV3)
- **Gemini API key** lấy tại <https://aistudio.google.com/apikey>
- Tài khoản Zalo đăng nhập được trên <https://chat.zalo.me>

Chạy server **không cần** Flutter, Dart hay melos. Phần Flutter ở cuối README chỉ dành cho ai phát triển app di động.

## 2. Cấu trúc thư mục (phần liên quan)

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
├── package.json               # npm test / npm run lint (không có dependency)
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

## 3. Build & chạy server

Server **không có bước build**: Node chạy thẳng `server.js`, và Dashboard (`web_dist/index.html`) đã build sẵn.

### 3.1 Lấy mã nguồn

```bash
git clone git@github.com:minhkhang0107/SaleHelp.git
cd SaleHelp/salehelp          # đường dẫn có thể khác nếu repo được đặt trong thư mục khác
```

### 3.2 Cấu hình Gemini API key

API key **không nằm trong source code**. Có 2 cách cung cấp, theo thứ tự ưu tiên:

**Cách 1 (khuyến nghị): nhập trên Dashboard**

1. Chạy server (mục 3.3) và mở <http://localhost:8080>
2. Vào tab **Settings** (cuối thanh bên trái)
3. Dán API key rồi bấm **Lưu & kiểm tra**

Server gọi thử Google để xác nhận key hợp lệ rồi mới lưu. Key được ghi vào `settings.local.json` (quyền `0600`, đã nằm trong `.gitignore`) và dùng ngay cho mọi yêu cầu AI, kể cả extension Zalo, không cần khởi động lại. Dashboard chỉ hiển thị 4 ký tự cuối của key; server không bao giờ trả key đầy đủ về trình duyệt. Nút **Xóa key** xóa key đã lưu.

**Cách 2 (dự phòng): file `.env`**

```bash
cp .env.example .env     # .env nằm trong .gitignore
```

```env
GEMINI_API_KEY=<API key của bạn>
```

Chỉ được dùng khi chưa có key nhập từ Dashboard. Server **không còn đọc** `.env.example`. File này được theo dõi bởi git nên để trống key.

Lưu ý:
- Không bao giờ commit key thật lên git. Đừng dán key vào `.env.example`.
- Có thể gửi key riêng cho từng request qua trường `apiKey` trong body của `/api/gemini/generate`; trường này được ưu tiên cao nhất.
- Biến `GEMINI_PROXY_ENDPOINT` cũ chỉ dùng cho app Flutter, server Node bỏ qua.

### 3.3 Chạy

```bash
node server.js
```

Thấy các dòng sau là server đã lên:

```
🚀 SaleHelp Real Multi-Channel Proxy Server running at http://localhost:8080/
• Real Gemini AI Proxy: POST http://localhost:8080/api/gemini/generate (Key loaded: Yes)
```

Dòng `Key loaded: No` nghĩa là chưa có key nào. Vào Dashboard > Settings để nhập (mục 3.2).

### 3.4 Kiểm tra nhanh

```bash
curl http://localhost:8080/api/persona      # trả JSON persona
curl http://localhost:8080/api/tours        # trả danh sách tour
curl -X POST http://localhost:8080/api/gemini/generate \
     -H 'Content-Type: application/json' \
     -d '{"prompt":"Xin chào"}'             # trả về câu trả lời của Gemini
```

Gọi `/api/gemini/generate` mà nhận lỗi `Chưa có Gemini API key` thì chưa nhập key. Nhận `401 ... invalid authentication credentials` thì key sai hoặc đã bị thu hồi.

Mở <http://localhost:8080> để vào Dashboard.

### 3.5 Chạy nền / tự khởi động lại

```bash
# Cách đơn giản
nohup node server.js > server.log 2>&1 &

# Hoặc dùng pm2 (khuyến nghị nếu chạy lâu dài)
npm install -g pm2
pm2 start server.js --name salehelp
pm2 logs salehelp
pm2 save && pm2 startup      # tự chạy lại khi khởi động máy
```

### 3.6 Đổi cổng

Cổng mặc định là `8080`, đổi bằng biến môi trường `PORT` (ví dụ `PORT=9090 node server.js`). Muốn extension dùng cổng khác phải sửa đủ 3 nơi:

1. Biến môi trường `PORT` khi chạy server
2. `host_permissions` trong `extension/manifest.json` (hai dòng `localhost:8080` và `127.0.0.1:8080`)
3. Ô **Server URL** trong popup của extension

Sau đó tải lại extension (xem mục 5).

## 4. Chuẩn bị dữ liệu cho AI

Với profile bật kho dữ liệu (mặc định là `sales_tour`), AI **chỉ được phép** nêu giá, số ngày/đêm và dịch vụ có trong kho tour. Hãy nhập kho tour trước khi bật tự động trả lời. Kho trống thì extension sẽ không tự trả lời. Profile tắt kho dữ liệu (`work`, `dating`) không cần kho tour.

Cách sửa dữ liệu: dùng Dashboard (tab **Profiles** cho profile, tab **Knowledge** cho tour và persona của profile đang dùng, tab **Skills** cho skill của profile đang dùng) hoặc sửa trực tiếp các file JSON. Server đọc file mỗi lần có request nên **không cần khởi động lại**; extension tự đồng bộ lại sau tối đa ~8 giây.

### `profiles_config.json` (Profiles)

Một **profile** là một bộ cấu hình AI hoàn chỉnh. Có thể tạo nhiều profile và đổi profile đang dùng ngay trên server (Dashboard > **Profiles**, hoặc `POST /api/profiles/set-active`); extension tự áp dụng sau tối đa ~8 giây.

Profile có sẵn:

| ID | Dùng cho | Kho tour | Chặn sai giá |
|---|---|---|---|
| `sales_tour` | Tư vấn & chốt đơn tour (hành vi cũ) | Bật, bắt buộc | Có |
| `work` | Trao đổi công việc với đồng nghiệp/đối tác | Tắt | Không |
| `dating` | Trò chuyện / hẹn hò (thân thiện, tôn trọng, không phủ nhận là AI nếu bị hỏi thẳng) | Tắt | Không |

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

| Trường | Ý nghĩa |
|---|---|
| `id` | 2–40 ký tự `a-z 0-9 _ -`, không đổi được sau khi tạo |
| `persona` | Tên / chức danh / giọng điệu AI đóng vai |
| `skills`, `activeSkillId` | Các system prompt của profile và prompt đang dùng. Placeholder: `{PERSONA_NAME}`, `{PERSONA_TITLE}`, `{PERSONA_TONE}`, `{CUSTOMER_NAME}` |
| `knowledge.enabled` | Nối kho tour vào prompt |
| `knowledge.required` | Kho trống thì không tự trả lời |
| `knowledge.strictGuard` | Đối chiếu giá / số ngày đêm trong câu trả lời với kho, sai thì viết lại rồi dùng câu `handoff` |
| `summaryPrompt` | Prompt tóm tắt hội thoại cũ của từng người (trí nhớ, mục 6.5) |
| `replies.fallback` / `replies.handoff` | Câu dự phòng khi Gemini không trả lời / khi câu trả lời bị chặn |
| `generation` | `temperature` (0–2), `topP` (0–1) |

Lần đầu chạy, nếu chưa có `profiles_config.json`, server tự tạo file này từ 3 mẫu trên; profile `sales_tour` lấy persona và skill từ `persona_config.json` / `skills_config.json` cũ. File hỏng (JSON sai) thì server báo lỗi chứ không ghi đè. Không xóa được profile đang dùng hoặc profile cuối cùng.

### `tours_config.json`

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

Số tiền và thời lượng AI nói ra được đối chiếu với kho này. Nếu không khớp, câu trả lời bị chặn (xem mục 6.4).

### Persona và skill

Persona và skill nằm trong từng profile. Form Persona (tab Knowledge), tab Skills và các API `/api/persona*`, `/api/skills*` luôn đọc/ghi **profile đang dùng**. `persona_config.json` / `skills_config.json` không còn được đọc sau lần chuyển đổi đầu tiên.

> Các file `*_config.json` đang được theo dõi bởi git. Mỗi lần sửa qua Dashboard, file thay đổi và hiện trong `git status`.

## 5. Cài Chrome Extension

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc trên phải)
3. Bấm **Load unpacked** rồi chọn thư mục `salehelp/extension`
4. (Tuỳ chọn) Ghim icon **SaleHelp** lên thanh công cụ
5. Mở <https://chat.zalo.me> và đăng nhập. Widget 🤖 hiện ở góc màn hình

**Sau khi sửa code extension**: vào `chrome://extensions`, bấm biểu tượng tải lại ở thẻ SaleHelp, rồi **F5 tab Zalo**. Chỉ tải lại extension mà không F5 thì tab Zalo vẫn chạy bản cũ.

### Cấu hình trong popup (bấm icon extension)

| Mục | Ý nghĩa |
|---|---|
| Tự động trả lời | Bật/tắt auto-reply |
| Server URL | Mặc định `http://localhost:8080` |
| Độ trễ | Số giây chờ trước khi gửi (để giống người thật) |
| **Lưu** | Ghi cấu hình vào `chrome.storage` |

Popup còn có nút mở Dashboard, nút mở Zalo Web, và một nhãn trạng thái cho biết đã kết nối server hay chưa.

## 6. Sử dụng

### 6.1 Widget trên Zalo Web

Widget nổi (kéo thả được, bấm `_` để thu nhỏ) hiển thị:

- **Tự động trả lời**: công tắc bật/tắt.
- **Skill & Knowledge**: skill đang dùng. Bấm vào để mở Dashboard sửa.
- **Đang chat với**: tên khách ở chat đang mở và tin nhắn cuối chưa được trả lời.
- **Hàng đợi (Queue)**: những khách khác đang nhắn mà chưa được xử lý.
- **⚡ Trả Lời Người Này**: ép AI trả lời ngay cho chat đang mở (kể cả khi auto-reply tắt).
- **📋 Copy**: sao chép câu AI vừa soạn để dán thủ công.
- **Chấm trạng thái**: xanh là kết nối server tốt, đỏ là server chưa chạy.

### 6.2 Luồng tự động

1. Cứ mỗi 1,5 giây extension kiểm tra chat đang mở. Nếu tin cuối là của khách và chưa trả lời, nó gửi lịch sử + kho tour cho Gemini.
2. Chờ đúng số giây "độ trễ", điền câu trả lời vào ô chat rồi gửi.
3. Khách khác nhắn tới sẽ được thêm vào hàng đợi, và extension tự click sang chat đó sau khi chat hiện tại xong.

### 6.3 Nhiều khách cùng lúc

- Đang trả lời A mà B nhắn tới: B chờ trong hàng đợi, trả lời A xong mới sang B.
- Nếu B chờ quá **20 giây**, A không được bắt đầu câu trả lời mới nữa mà nhường lượt cho B (hằng số `MAX_QUEUE_WAIT_MS` trong `content.js`).
- Nếu bạn tự chuyển sang chat khác trong lúc AI đang chờ gửi cho A, câu trả lời **bị hủy** (không gửi nhầm cho người khác) và A được đưa lại vào hàng đợi.

### 6.4 Chống bịa thông tin

- AI bị yêu cầu chỉ dùng thông tin trong kho tour, nhiệt độ sinh thấp (`temperature 0.2`).
- Trước khi gửi, extension kiểm tra mọi **số tiền** và **thời lượng (3N2Đ…)** trong câu trả lời có nằm trong kho không. Sai thì cho AI viết lại một lần. Vẫn sai thì gửi câu an toàn "em xin phép kiểm tra lại với bộ phận điều hành…" và hiện cảnh báo trên widget. Bản bị chặn được ghi ở Console của tab Zalo.
- Kho tour trống thì không tự trả lời.
- Giới hạn: kiểm tra chỉ bắt được sai ở giá và thời lượng, không bắt được việc bịa tên điểm tham quan hay dịch vụ.

### 6.5 Trí nhớ theo từng khách

- Lịch sử mỗi khách được lưu riêng (theo tên hiển thị) trong `chrome.storage` của extension, không bị lẫn giữa các khách.
- Khi hội thoại vượt 40 tin, phần cũ được AI tóm tắt thành các ý chính (nhu cầu, thời gian, số người, ngân sách, tour quan tâm, việc cần làm, trạng thái) và đưa vào prompt. 16 tin gần nhất giữ nguyên văn. Các ngưỡng nằm ở `SUMMARIZE_THRESHOLD` và `SUMMARIZE_KEEP_RECENT` trong `content.js`.
- Giữ tối đa 200 khách, khách lâu không nhắn bị xóa trước.
- Hai khách trùng tên hiển thị sẽ dùng chung trí nhớ.
- Muốn xóa trí nhớ: `chrome://extensions` → SaleHelp → *Details* → xóa dữ liệu, hoặc chạy trong Console của extension: `chrome.storage.local.remove('salehelp_memory')`.

### 6.6 Dashboard (`http://localhost:8080`)

| Tab | Chức năng |
|---|---|
| Chat | Giao diện hộp thư và chat thử với AI |
| Profiles | Tạo (từ mẫu hoặc trống), sửa, xóa profile và chọn profile đang dùng |
| Knowledge | Quản lý tour/ưu đãi và persona |
| Channels | Kết nối kênh Zalo OA, Zalo cá nhân, Telegram, Facebook |
| Skills | Tạo/sửa skill, chọn skill đang bật |
| Webhooks | Xem log sự kiện realtime (SSE) |
| Settings | Nhập / xóa Gemini API key |

## 7. API của server

Tất cả trả JSON. CORS mở `*`, nên extension và Dashboard gọi được từ mọi origin.

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

## 8. Kiểm thử

```bash
npm test                     # profile store, API profiles của server, dựng prompt của extension
npm run lint                 # kiểm tra cú pháp server.js, profile_store.js, extension/*.js
node test_zalo_oa_pure_web.js
```

`npm test` chạy server trong thư mục tạm (`SALEHELP_DATA_DIR`) nên không sửa file trong repo. `test_zalo_oa_pure_web.js` chạy 4 test logic Zalo OA (PKCE, chữ ký HMAC-SHA256, định tuyến nhiều OA, làm mới token), không cần mạng. Phần thao tác DOM trên Zalo Web của extension chưa có test tự động; kiểm tra bằng cách mở Zalo Web và xem Console (`F12`), log của extension bắt đầu bằng `[SaleHelp]`.

## 9. Bảo mật: đọc trước khi đưa lên server thật

Server được viết để chạy **trên máy cá nhân**, và hiện:

- Lắng nghe trên **mọi giao diện mạng** (`0.0.0.0`), không chỉ localhost.
- Không có xác thực. Ai truy cập được cổng 8080 đều đọc/sửa được kho tour, profile (persona, skill) và **dùng API key Gemini của bạn** qua `/api/gemini/generate`.
- CORS `*` cho phép mọi trang web gọi vào server.

Vì vậy: **không mở cổng 8080 ra internet**, không đưa lên VPS khi chưa thêm xác thực và giới hạn địa chỉ lắng nghe (`server.listen(PORT, '127.0.0.1')`). Nếu cần truy cập từ xa, đặt sau reverse proxy có xác thực (Nginx + Basic Auth, Cloudflare Access, Tailscale…).

Về API key:
- Key nằm trong `settings.local.json` (quyền `0600`, bị git bỏ qua), không nằm trong source. Hai endpoint `/api/settings*` từ chối request mang `Origin` của trang web lạ, nhưng vì server không có xác thực nên **ai truy cập được cổng 8080 vẫn có thể đặt lại key hoặc dùng key đó để gọi Gemini**. Giữ server ở localhost.
- `.env.example` là file được theo dõi bởi git, không được chứa key thật. Nếu từng commit key vào đó, hãy **thu hồi (revoke) key ở Google AI Studio và tạo key mới**, vì sửa hoặc xóa file không xóa khỏi lịch sử git.

## 10. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp / cách xử lý |
|---|---|
| Widget báo "Chưa bật SaleHelp Server" | Server chưa chạy hoặc sai Server URL. Chạy `node server.js`, kiểm tra `curl localhost:8080/api/persona` |
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

## 11. Phát triển app Flutter (tuỳ chọn)

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

## Giấy phép

MIT
