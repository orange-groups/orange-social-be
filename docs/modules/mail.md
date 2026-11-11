# Mail — tích hợp Resend có kiểm soát

[Mục lục và quy ước chung](README.md)

## Hiện trạng và scope

`src/modules/mail/` có MailModule/MailService và types, chỉ throw NotImplementedException. Chưa cài `resend`; AuthModule chưa import MailModule. Recovery hiện vẫn gửi SMTP qua Nodemailer, không thay bằng placeholder.

Không có controller hoặc API gửi email tùy ý. Auth sở hữu token/cooldown/TTL/revoke session; Mail chỉ giao nhận email.

## Contract nội bộ

- `sendPasswordReset({ to, resetUrl, requestId })` → `{ providerMessageId }`.
- `sendTransactionalEmail(input)` private: to/subject/text/html tùy chọn/idempotencyKey.
- Không xuất providerMessageId/reset token qua response auth.

## Cấu hình dự kiến

Sau khi duyệt package và provider, cấu hình RESEND_API_KEY, MAIL_FROM và FRONTEND_URL trên BE. Người gửi/domain phải được Resend cho phép; tài khoản thử nghiệm có thể giới hạn người nhận. Không đưa secret vào FE hoặc Markdown. Giữ config Redis recovery hiện tại.

## Trình tự triển khai

1. Cài SDK sau duyệt, wire config và client; thiếu cấu hình xử lý thành lỗi khả dụng, không fake success.
2. Dựng template nội bộ text/HTML; escape dữ liệu chèn vào HTML và validate reset URL do auth dựng từ FRONTEND_URL.
3. Gửi với timeout; kiểm tra cả rejected promise và error trong response SDK. Retry nếu có phải dùng idempotency key ổn định cho cùng lần gửi, không tự gửi trùng.
4. Sau khi Mail có logic/test thật, AuthModule import MailModule và inject vào PasswordRecoveryService thay transport Nodemailer.
5. Giữ token ngẫu nhiên/digest/Redis TTL 15 phút, cooldown và reset-session revocation. Khi gửi thất bại thu hồi token vừa cấp.
6. Giữ phản hồi chung cho email có/không tồn tại, bao gồm lỗi gửi riêng theo địa chỉ. Hiện auth có test SMTP failure trả 503: đánh giá thay đổi chống enumeration rõ ràng, cập nhật test/contract có chủ đích, không ghi là hành vi đã có.
7. Chỉ gỡ Nodemailer/config SMTP sau khi tìm hết consumers và regression pass; không thay cookie/JWT trong task mail.

## Kiểm thử nghiệm thu

Mock SDK success/error response/exception/timeout, escape HTML, key ổn định, không log link/token/email credentials. Auth regression cho known/unknown email, token cleanup, token hết hạn/dùng lại và revoke session. Test domain gửi sandbox riêng, không gửi mail thật trong unit tests.
