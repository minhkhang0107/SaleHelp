# SaleHelp

SaleHelp là hệ thống trợ lý AI tự động tư vấn và trả lời khách hàng trên Zalo Web kết hợp Node.js proxy server và Chrome Extension (Manifest V3).

## Khởi động nhanh

```bash
cd salehelp && npm start
```

1. Mở trang quản trị tại <http://localhost:8080> để nhập Gemini API key (tab Settings) và thêm tour (tab Knowledge).
2. Vào `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ đến thư mục `salehelp/extension`.
3. Mở <https://chat.zalo.me> và bật công tắc **Tự động trả lời** trên widget SaleHelp.

## Tài liệu

- Hướng dẫn cài đặt, cấu hình và sử dụng chi tiết: xem [salehelp/README.md](salehelp/README.md).
- Đặc tả yêu cầu kỹ thuật và tài liệu thiết kế: xem thư mục [docs/spec/](docs/spec/).

## Giấy phép

MIT
