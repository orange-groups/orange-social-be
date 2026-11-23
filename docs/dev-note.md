# Dev note — Orange Social

## UC-PROFILE-02 — Xem và cập nhật thông tin cá nhân

**Tác nhân:** Người dùng đã đăng nhập.

**Mục tiêu:** Sửa họ tên, giới thiệu hoặc ngày sinh; khi mở lại `/profile` sẽ thấy thông tin đã lưu.

1. `GET /profile/me` đọc hồ sơ của user trong JWT, trả ngày sinh `YYYY-MM-DD` và số bạn bè thực, không trả email, thông tin xác thực hay mật khẩu.
2. `PATCH /profile/me` nhận một hoặc nhiều trường `fullName`, `bio`, `dateOfBirth`. Trường thiếu được giữ nguyên; `null` xóa giới thiệu hoặc ngày sinh. Từ chối tên trắng, ngày sai hoặc ở tương lai, trường ngoài danh sách và request rỗng.
3. Backend cập nhật bảng `users` hiện có. Chỉ user chưa bị xóa thuộc phiên hiện tại được cập nhật. Không cần migration.
4. Frontend gọi `GET /profile/me` để hiển thị tên, username, ngày sinh và giới thiệu; email lấy từ phiên đăng nhập. Có trạng thái đang tải, lỗi và nút thử lại. Frontend chỉ đọc trong phạm vi này; chưa gọi `PATCH` từ giao diện.

Xem [hợp đồng API Profile](modules/profile.md). Đổi email, mật khẩu và hồ sơ công khai không thuộc use case này.

**Kiểm thử:** Đã xác nhận `GET`/`PATCH` trên PostgreSQL cục bộ cô lập: dữ liệu được lưu, tài khoản khác không đổi và số bạn bè không tính tài khoản đã xóa. Playwright với API giả lập xác nhận lỗi tải, thử lại và hiển thị dữ liệu trả về.
