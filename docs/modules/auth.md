# Auth — duy trì hành vi đang có

[Mục lục và quy ước chung](README.md)

## Hiện trạng và file sở hữu

`src/modules/auth/` đã có AuthService, AuthSessionService, UserSessionRepository và PasswordRecoveryService. Recovery đang dùng Nodemailer + Upstash Redis, **không gọi MailService**. Không viết lại auth khi triển khai các module còn lại.

## Contract hiện có

| API | Input/credential | Kết quả chính |
| --- | --- | --- |
| `POST /auth/regis` | fullName, email, password | 201 accessToken + user, đặt refresh cookie |
| `POST /auth/login` | email, password | 200 cùng dạng session |
| `POST /auth/refresh` | refresh cookie | 200 session đã rotate |
| `POST /auth/logout` | refresh cookie | 200 message, xóa cookie |
| `GET /auth/me` | Bearer access token | 200 AuthUserDto |
| `POST /auth/forgot-password` | email | 200 thông báo chung khi xử lý bình thường |
| `POST /auth/reset-password` | token, newPassword | 200 message |

Đối chiếu DTO thật cho validation: register hiện yêu cầu password 8–128 ký tự và độ phức tạp; login tối đa 128; reset 12–72 ký tự và tối đa 72 byte. Không âm thầm đồng nhất các giới hạn trong task khác.

## Bất biến khi tích hợp

1. Access token là Bearer JWT; refresh token trong cookie HttpOnly, path `/auth`, SameSite Lax, Secure ở production. Không chuyển refresh token vào JSON/localStorage.
2. Giữ rotation có điều kiện trên hash cũ và tokenVersion; DB outage không được đổi thành lỗi token không hợp lệ.
3. Giữ TrustedOriginGuard trên các endpoint hiện áp dụng; một FRONTEND_URL cho CORS/origin/reset link. Không dựng link từ Host/Origin tùy ý.
4. `/auth/me` là nơi trả email của chính user. Public profile/search không dùng lại toàn bộ AuthUserDto.
5. Reset token ngẫu nhiên được lưu dưới dạng digest ở Redis, TTL 15 phút, consume một lần; reset tăng tokenVersion và thu hồi refresh session.
6. Không đưa role/permission framework vào dự án khi chưa có yêu cầu.

## Cấu hình và việc cần chốt

Rà soát config hiện có: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, FRONTEND_URL; recovery dùng UPSTASH_REDIS_REST_URL/TOKEN và MAIL_HOST/PORT/SECURE/USER/PASSWORD/FROM. Không đọc/in giá trị secret khi debug.

Nếu chuyển Resend, thực hiện theo [mail.md](mail.md), bao gồm auth import MailModule và kiểm thử phản hồi chống enumeration khi gửi lỗi. Đây là thay đổi riêng cần duyệt, không được nối auth với placeholder 501.

## Kiểm thử nghiệm thu

- Giữ các test auth/session/recovery hiện có; bổ sung regression khi thay dependency.
- Login sai, user soft-delete, refresh hết hạn/đã dùng, refresh đồng thời, logout và lỗi DB.
- Reset token hết hạn/dùng lại, lỗi provider và thu hồi session sau reset.
- Sau đổi tên/avatar, `/auth/me` trả dữ liệu mới; cookie thực tế hoạt động ở domain FE/BE deployment đã chọn.
- Không log password, token, link reset hoặc full user record.
