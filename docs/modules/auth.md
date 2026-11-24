# Guide tích hợp Auth

[Mục lục module](README.md) · [Mail](mail.md)

## 1. Module dùng để làm gì?

Đăng ký, đăng nhập, giữ phiên và khôi phục mật khẩu. Các API dưới đây đã có logic;
checklist phục vụ tích hợp/regression, không yêu cầu viết lại auth.
Dùng PostgreSQL, JWT và refresh cookie HttpOnly. Auth dùng Upstash Redis cho
token khôi phục và gọi MailService để gửi email qua Resend.

## 2. Tích hợp theo từng API

Ví dụ dùng dữ liệu giả. Giữ TrustedOriginGuard trên các endpoint đang áp dụng;
không đổi chiến lược session hoặc thêm role framework trong task khác.

### API 1 — POST /auth/regis

**Input:**

```json
{ "fullName": "Nguyễn An", "email": "an@example.com", "password": "Example@12345" }
```

**Output — HTTP `201 Created`:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<access-token>",
    "user": { "id": "<user-uuid>", "email": "an@example.com", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null, "isEmailVerified": false, "createdAt": "2026-11-11T08:00:00.000Z" }
  }
}
```

- [ ] Controller/DTO
  - [ ] Giữ trim fullName 1–150 và normalize email; password 8–128 ký tự, có hoa/thường/số/ký tự đặc biệt.
- [ ] Service/session
  - [ ] Kiểm tra email trùng, hash password, tạo user; không trả hashes.
  - [ ] Trả access token trong data; refresh token chỉ qua Set-Cookie HttpOnly, không JSON/localStorage.
- [ ] FE và kiểm thử
  - [ ] Gửi credentials: include, giữ access token trong memory.
  - [ ] Test validation/email conflict và cookie; không điều hướng sang xác minh email giả vì chưa có API OTP.

### API 2 — POST /auth/login

**Input:**

```json
{ "email": "an@example.com", "password": "Example@12345" }
```

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<access-token>",
    "user": { "id": "<user-uuid>", "email": "an@example.com", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null, "isEmailVerified": false, "createdAt": "2026-11-11T08:00:00.000Z" }
  }
}
```

- [ ] Controller/service
  - [ ] Validate email/password theo LoginDto, password tối đa 128 ký tự; so bcrypt, bỏ user soft-delete.
  - [ ] Sai email/password cùng thông báo 401; lưu refresh hash và đặt cookie.
- [ ] FE và kiểm thử
  - [ ] Chỉ set session sau response thật; success về trang trước đó hoặc home.
  - [ ] Test sai credentials, deleted user, thiếu config và lỗi kết nối DB 503, không log password/token.

### API 3 — POST /auth/refresh

**Input:** không body; refresh token trong cookie HttpOnly, gửi credentials: include.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<new-access-token>",
    "user": { "id": "<user-uuid>", "email": "an@example.com", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null, "isEmailVerified": false, "createdAt": "2026-11-11T08:00:00.000Z" }
  }
}
```

- [ ] Controller/service
  - [ ] Verify cookie/hash/tokenVersion và rotate có điều kiện theo hash cũ; response đặt refresh cookie mới.
  - [ ] Giữ HttpOnly, path `/auth`, SameSite Lax, Secure production.
  - [ ] Chỉ clear cookie khi 401; DB outage trả 503, không đổi thành credentials sai.
- [ ] FE và kiểm thử
  - [ ] Restore sau reload, gom refresh đồng thời; 503 giữ session và cho retry, 401 về guest.
  - [ ] Test expired/reused token, rotation đồng thời, version thay đổi và cookie trên domain deployment thật.

### API 4 — POST /auth/logout

**Input:** refresh cookie, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "message": "Đã đăng xuất." } }
```

- [ ] Controller/service
  - [ ] Thu hồi refresh hash phù hợp, clear cookie với options cùng lúc tạo.
  - [ ] Gọi không có cookie vẫn an toàn.
- [ ] FE và kiểm thử
  - [ ] Clear memory/session, ngăn response refresh cũ khôi phục phiên đã logout.
  - [ ] Test logout/retry/missing cookie và refresh sau logout bị từ chối.

### API 5 — GET /auth/me

**Input:** Authorization Bearer access token, không body.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": { "id": "<user-uuid>", "email": "an@example.com", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null, "isEmailVerified": false, "createdAt": "2026-11-11T08:00:00.000Z" }
}
```

- [ ] Guard/service
  - [ ] Verify JWT và tokenVersion hiện tại; DB lỗi không trả 401 giả.
  - [ ] Chỉ trả AuthUserDto của chính user; không dùng DTO này cho public search/profile.
- [ ] FE và kiểm thử
  - [ ] Test thiếu/sai/expired token, user deleted và tên/avatar mới sau cập nhật hồ sơ.

### API 6 — POST /auth/forgot-password

**Input:**

```json
{ "email": "an@example.com" }
```

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "message": "Nếu email đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu." } }
```

- [ ] Controller/service
  - [ ] Normalize email, giữ cooldown; token random lưu digest Redis với TTL 15 phút.
  - [ ] Dựng link từ FRONTEND_URL tin cậy, không lấy Host/Origin tùy ý; kiểm tra `RESEND_API_KEY` và `MAIL_FROM` ở backend.
  - [ ] Gửi lỗi thu hồi token; thiếu config/hạ tầng xử lý lỗi khả dụng, không log link/secret.
- [ ] FE và kiểm thử
  - [ ] Chỉ mở check-email sau response success; không có đường reset demo.
  - [ ] Test known/unknown email, cooldown và provider failure; khi đổi provider phải chốt rõ phản hồi chống enumeration, không coi hành vi mới đã có.

### API 7 — POST /auth/reset-password

**Input:**

```json
{ "token": "<64-lowercase-hex>", "newPassword": "NewExample@12345" }
```

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "message": "Đặt lại mật khẩu thành công." } }
```

- [ ] Controller/DTO
   - [ ] Token 64 lowercase hex; mật khẩu mới theo policy chung với đăng ký và đổi mật khẩu: 8–128 ký tự, có chữ cái, chữ số và ký tự đặc biệt.
- [ ] Service/database
  - [ ] Consume token một lần, hash bcrypt, tăng tokenVersion và xóa refresh hash.
  - [ ] Giữ giới hạn hiện tại: DB ghi lỗi sau consume thì cần xin link mới; không giả success.
- [ ] FE và kiểm thử
  - [ ] Lấy token từ link thật; thành công mới báo đổi xong và mời login lại.
  - [ ] Test expired/reused token, bcrypt login với mật khẩu mới và session cũ bị thu hồi.

## 3. Nghiệm thu

- [ ] Toàn bộ auth regression pass; không log email credentials/password/JWT/reset link.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module); test live mail chỉ với sandbox được phép.
