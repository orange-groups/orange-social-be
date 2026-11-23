# Dev note — Orange Social

## UC-PROFILE-02 — Xem và cập nhật thông tin cá nhân

**Tác nhân:** Người dùng đã đăng nhập.

**Mục tiêu:** Sửa họ tên, giới thiệu hoặc ngày sinh; khi mở lại `/profile` sẽ thấy thông tin đã lưu.

1. `GET /profile/me` đọc hồ sơ của user trong JWT, trả ngày sinh `YYYY-MM-DD` và số bạn bè thực, không trả email, thông tin xác thực hay mật khẩu.
2. `PATCH /profile/me` nhận một hoặc nhiều trường `fullName`, `bio`, `dateOfBirth`. Trường thiếu được giữ nguyên; `null` xóa giới thiệu hoặc ngày sinh. Từ chối tên trắng, ngày sai hoặc ở tương lai, trường ngoài danh sách và request rỗng.
3. Backend cập nhật bảng `users` hiện có. Chỉ user chưa bị xóa thuộc phiên hiện tại được cập nhật. Không cần migration.
4. Frontend gọi `GET /profile/me` để hiển thị tên, username, ngày sinh và giới thiệu; email lấy từ phiên đăng nhập. Bấm **Sửa thông tin cá nhân** để chỉnh họ tên, giới thiệu và ngày sinh. Form gửi `PATCH` chỉ với các trường thay đổi, hiển thị dữ liệu server trả về nếu lưu thành công và giữ bản nháp nếu lưu lỗi.

Xem [hợp đồng API Profile](modules/profile.md). Đổi email, mật khẩu và hồ sơ công khai không thuộc use case này.

**Kiểm thử:** Đã xác nhận `GET`/`PATCH` trên PostgreSQL cục bộ cô lập: dữ liệu được lưu, tài khoản khác không đổi và số bạn bè không tính tài khoản đã xóa. Playwright với API giả lập kiểm tra tải dữ liệu, mở/hủy chỉnh sửa, giữ bản nháp khi lỗi và gửi lại thành công.

## UC-AUTH-01 — Đổi mật khẩu khi đang đăng nhập

Tại `/profile`, người dùng nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới. Frontend chỉ gửi `{ currentPassword, newPassword }` bằng `POST /auth/change-password` với Bearer access token. Mật khẩu mới tối thiểu 12 ký tự, tối đa 72 byte UTF-8 và phải khác mật khẩu hiện tại.

Backend kiểm tra mật khẩu hiện tại bằng bcrypt rồi lưu hash mới, tăng `token_version` và đặt `refresh_token_hash` thành `null` trong cùng một lệnh cập nhật. Nếu mật khẩu đã bị đổi bởi request khác, lệnh không ghi đè và API trả `409`.

- `200`: trả `{ "success": true, "data": { "message": "Đã đổi mật khẩu. Vui lòng đăng nhập lại." } }`, xóa refresh cookie và vô hiệu hóa các phiên cũ. Frontend xóa phiên trong bộ nhớ, chuyển về đăng nhập và thông báo thành công.
- `400`: input không hợp lệ hoặc dùng lại mật khẩu hiện tại. `401`: thiếu hoặc hết hạn phiên. `403`: mật khẩu hiện tại không đúng.
- Không cần migration. Đây là luồng riêng với **Quên mật khẩu** qua email.

**Kiểm thử:** E2e kiểm tra xác thực, validation, mật khẩu hiện tại sai, vô hiệu hóa access/refresh token cũ và đăng nhập với mật khẩu mới. Trên PostgreSQL cô lập, hai request đổi đồng thời chỉ có một request thành công. Playwright với API giả lập kiểm tra xác nhận mật khẩu, báo lỗi và về `/login` khi thành công.
