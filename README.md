# Quản lý sách - 23IT228

Ứng dụng Node.js/Express/Mongoose kết nối đồng thời hai tài khoản MongoDB Atlas độc lập. `GET /books` dùng model trên connection READ; `POST /books` dùng model trên connection WRITE và chỉ tạo bản ghi sách mới. Session của Express được lưu trong `DB_23IT228.sessions`: đọc qua READ connection, ghi/cập nhật/xóa qua WRITE connection. Mã sách phải bắt đầu bằng `228`. Giá sau VAT được tính với mức 12% trước khi lưu.

## Cài đặt và chạy

Yêu cầu Node.js 20.19 trở lên. Project dùng Mongoose 9 và MongoDB Node.js Driver 7, tương thích Node.js 24. Trong thư mục project:

```powershell
npm install
Copy-Item .env.example .env
```

Mở `.env`, thay `<READ_PASSWORD>` và `<WRITE_PASSWORD>` bằng mật khẩu thực tế, và đặt `SESSION_SECRET` thành chuỗi ngẫu nhiên dài ít nhất 32 ký tự. Nếu mật khẩu có ký tự đặc biệt như `@`, `#`, `/`, hãy URL-encode phần mật khẩu. Giữ `.env` riêng trên máy; `.gitignore` đã loại file này và `node_modules/`.

```powershell
npm start
```

Mở `http://localhost:3000/books`. Server chỉ khởi động sau khi cả hai connection đăng nhập thành công. Database được chọn rõ là `DB_23IT228`; model READ và WRITE cùng ánh xạ tới collection `books`.

## Quyền tối thiểu cho đúng 2 tài khoản

Trong Atlas, giữ nguyên `23IT228_read` với `read@DB_23IT228`. Sửa custom role `writeOnly_23IT228` của `23IT228_write` để có:

| Collection | Actions |
| --- | --- |
| `DB_23IT228.books` | `INSERT` |
| `DB_23IT228.sessions` | `INSERT`, `UPDATE`, `REMOVE` |

Không gán quyền `FIND` cho tài khoản WRITE. Tạo trước collection `DB_23IT228.sessions` và TTL index `{ expiresAt: 1 }` với `expireAfterSeconds: 0` bằng tài khoản quản trị trong Atlas; ứng dụng không tạo collection/index. Dữ liệu hết hạn được lọc ngay khi đọc và TTL index dọn các bản ghi cũ. Tài khoản `23IT228_session` thứ ba, nếu đã tạo, không được dùng trong project hai tài khoản này.

Nếu gặp lỗi `tlsv1 alert internal error`, hãy kiểm tra **Atlas → Network Access → IP Access List**. Một số mạng dùng nhiều IP công khai luân phiên: thêm một IP bằng nút *Add Current IP Address* có thể vẫn khiến kết nối lúc được lúc không. Kiểm tra IP nhiều lần hoặc thử một mạng ổn định khác; không dùng `tlsAllowInvalidCertificates` để bỏ qua TLS. Ứng dụng chỉ thử lại vài lần đối với lỗi mạng tạm thời, không thể sửa cấu hình mạng/Atlas từ trong code.

## Kiểm tra

Trong PowerShell khác:

```powershell
Invoke-WebRequest http://localhost:3000/books
Invoke-RestMethod -Uri http://localhost:3000/books -Method Post -ContentType 'application/json' -Body '{"code":"228-BOOK01","title":"Lập trình Node.js","author":"Trần Thanh Quý","price":100000}'
Invoke-WebRequest http://localhost:3000/books
```

POST hợp lệ trả HTTP 201 với `priceAfterVAT: 112000`. Mã bắt đầu khác `228` trả HTTP 400 và không ghi vào database. Khi dùng biểu mẫu trên web, POST thành công trả HTTP 303 và trình duyệt tải lại danh sách bằng READ account.

Console hiển thị `[READ] GET /books using 23IT228_read` và `[WRITE] POST /books using 23IT228_write`. Truy vấn sách dùng đúng model từ connection tương ứng. Session store tự đọc `sessions` bằng READ connection và chỉ dùng WRITE connection cho `updateOne`/`deleteOne` trên `sessions`. Mongoose `autoIndex` và `autoCreate` được tắt để tài khoản không cần quyền tạo index/collection.
