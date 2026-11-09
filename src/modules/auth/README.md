# Auth module

Đăng ký (Dân) và đăng nhập (Trung) dùng chung một cơ chế token.

| File | Chủ | Việc |
| --- | --- | --- |
| `auth.controller.ts`, `auth.service.ts`, `dto/register.dto.ts` | Dân | `POST /auth/regis`, tạo token (`issueTokens`), băm refresh token (`hashRefreshToken`) |
| `auth-session.controller.ts`, `auth-session.service.ts`, `dto/login.dto.ts` | Trung | Đăng nhập, refresh, đăng xuất, `/auth/me` |
| `repositories/user-session.repository.ts` | Trung | Truy vấn bảng `users` cho login/refresh/logout |
| `guards/jwt-auth.guard.ts` | Trung | Bảo vệ route bằng access token |
| `guards/trusted-origin.guard.ts` | Trung | Chặn request mang cookie từ trang lạ (CSRF) |

## API

| Method | Route | Body | Trả về |
| --- | --- | --- | --- |
| POST | `/auth/regis` | `{ fullName, email, password }` | `201 { accessToken, user }` + cookie |
| POST | `/auth/login` | `{ email, password }` | `200 { accessToken, user }` + cookie; sai thông tin: `401` |
| POST | `/auth/refresh` | (cookie) | `200 { accessToken, user }` + cookie mới; hết hạn/không hợp lệ: `401` |
| POST | `/auth/logout` | (cookie) | `200 { message }`, xoá cookie |
| GET | `/auth/me` | header `Authorization: Bearer <accessToken>` | `200 user`; thiếu/sai token: `401` |

`user` = `{ id, email, username, fullName, avatarUrl, isEmailVerified, createdAt }`. Không bao giờ trả mật khẩu hay hash.

## Token

| | Thời hạn | Lưu ở đâu |
| --- | --- | --- |
| Access token | 15 phút | Bộ nhớ của frontend (không lưu localStorage) |
| Refresh token | 1 ngày | Cookie `refresh_token`: `HttpOnly`, `SameSite=Lax`, `Path=/auth`, `Secure` khi production |

- Database chỉ lưu `bcrypt(sha256(refreshToken))` ở cột `users.refresh_token_hash`.
- Mỗi lần `/auth/refresh` cấp refresh token mới và làm token cũ hết hiệu lực.
- Mỗi user một phiên: đăng nhập ở máy khác thì phiên cũ không refresh được nữa.
- Khi `users.token_version` tăng (ví dụ đổi mật khẩu), mọi refresh token cũ bị từ chối.

## Dùng ở module khác

```ts
// some.module.ts
imports: [AuthModule]

// some.controller.ts
@Get('something')
@UseGuards(JwtAuthGuard)
getSomething(@CurrentUser() user: AccessTokenPayload) {
  // user.sub = id người đang đăng nhập
}
```

`JwtAuthGuard` và `AccessTokenPayload` nằm trong `src/modules/auth/`, `CurrentUser` nằm trong `src/common/decorators/`.

## Biến môi trường

```dotenv
JWT_ACCESS_SECRET=...      # bắt buộc
JWT_REFRESH_SECRET=...     # bắt buộc, khác access secret
FRONTEND_ORIGIN=http://localhost:5173   # nhiều origin cách nhau dấu phẩy
NODE_ENV=development       # production thì cookie có Secure (cần HTTPS)
```

## Test

```bash
npx jest src/modules/auth      # unit test
npm run test:e2e               # e2e (mock database)
```
# Password recovery

`POST /auth/forgot-password` accepts `{ "email": "..." }` and sends an SMTP
reset link for registered users. The response is deliberately the same for
unknown addresses. Requests are limited to one per address per minute.

`POST /auth/reset-password` accepts `{ "token": "...", "newPassword": "..." }`.
Tokens are random, stored as SHA-256 keys in Upstash Redis, expire after 15
minutes, and are single-use. Passwords require at least 12 characters and at
most 72 UTF-8 bytes (bcrypt limit). Reset revokes refresh tokens and increments
the version checked by access-token authentication. A database write failure
after consuming a token requires requesting another link.

Set `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
`FRONTEND_URL=http://localhost:5173` in `.env`. Without these settings, recovery
returns 503; login/registration still work. Use a sender authorized by your SMTP
provider. Port 465 normally uses `MAIL_SECURE=true`; port 587 uses
`MAIL_SECURE=false` with required STARTTLS. Both username and password must be
provided together; omit both only for an SMTP server allowing unauthenticated
delivery. No Resend API key is required.

This integration does not implement six-digit email verification.
