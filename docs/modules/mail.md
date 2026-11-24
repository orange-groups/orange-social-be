# Guide triển khai Mail

[Mục lục module](README.md) · [Auth](auth.md)

## 1. Module dùng để làm gì?

Dựng và gửi email qua Resend cho module khác. Auth vẫn sở hữu token, cooldown
và thu hồi session. **Không có API gửi email public.** `MailService` gửi email
đặt lại mật khẩu bằng HTTPS, không phụ thuộc SMTP hay SDK bổ sung.

Backend đọc `RESEND_API_KEY` (quyền **Sending access**) và `MAIL_FROM`. Sender
test `onboarding@resend.dev` chỉ dùng cho tài khoản Resend của bạn và các địa
chỉ giả lập của Resend. Để gửi cho người dùng thật, xác minh domain và chọn
sender trên domain đó. Không đưa API key vào frontend hoặc git.

## 2. Trình tự triển khai theo hàm nội bộ

### Hàm 1 — sendPasswordReset(input)

**Mục đích:** dựng email reset từ link do Auth tạo.

**Input nội bộ:**

```json
{ "to": "an@example.com", "resetUrl": "https://frontend.example/reset-password?token=<token>", "requestId": "<stable-request-id>" }
```

**Output nội bộ, không phải HTTP response:**

```json
{ "providerMessageId": "<provider-message-id>" }
```

- [ ] MailService
  - [x] Auth dựng reset URL từ FRONTEND_URL tin cậy; MailService dựng email plain text.
  - [ ] Tạo idempotency key ổn định từ requestId cho cùng lần gửi, chuyển cho hàm private.
  - [ ] Không log recipient/link/token và không trả provider ID qua API auth.
- [ ] Kiểm thử
  - [ ] Test template/escaping, URL sai, requestId ổn định và provider error; mock provider, không gửi mail thật.

### Hàm 2 — sendTransactionalEmail(input), private

**Input nội bộ:**

```json
{ "to": "an@example.com", "subject": "Đặt lại mật khẩu", "text": "<template-generated-text>", "html": "<template-generated-html>", "idempotencyKey": "<stable-key>" }
```

**Output nội bộ:**

```json
{ "providerMessageId": "<provider-message-id>" }
```

- [ ] Provider
  - [x] Gọi Resend Email API bằng HTTPS, đọc RESEND_API_KEY/MAIL_FROM từ BE.
  - [ ] Thiếu config trả lỗi khả dụng, không fake success; không đưa secrets vào FE.
  - [x] Gửi với timeout, kiểm tra lỗi mạng, HTTP và response thiếu ID.
  - [ ] Retry chỉ khi có chính sách/idempotency rõ ràng, không gửi trùng.
- [ ] Kiểm thử
  - [ ] Mock success/error/timeout, idempotency và không lộ provider payload/secret qua API.

## 3. Nối vào API Auth hiện có

- [x] AuthModule import MailModule; PasswordRecoveryService gọi MailService.
  - [ ] Giữ route/DTO/output JSON ở [Auth API 6–7](auth.md); không thêm `/send-email`.
  - [ ] Giữ random token/digest/Redis TTL 15 phút/cooldown/revoke session; gửi lỗi thu hồi token vừa tạo.
  - [x] Trả cùng thông báo với địa chỉ không tồn tại khi Resend từ chối gửi; thu hồi token vừa tạo.
  - [x] Gỡ Nodemailer và cấu hình SMTP mẫu; không đổi JWT/cookie.

## 4. Nghiệm thu

- [ ] Auth regression token expired/reused/cleanup/revocation và provider failure pass.
- [ ] Gửi sandbox được phép, dùng link đổi được mật khẩu; unit test không gửi live email.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module), ghi provider còn dùng và phần chưa triển khai.
