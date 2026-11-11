# Backend API skeleton

Khung theo `../IMPLEMENTATION_PLAN.md` tại workspace root. Chưa triển khai nghiệp vụ hoặc persistence.

## Hiện đã có

- Routes, DTO validation cơ bản và response types cho media, profile, friends, users, posts, feed, notifications.
- Tất cả API mới dùng JwtAuthGuard; controller chỉ đọc identity đã xác thực và chuyển tiếp service.
- Chữ ký hàm service/repository, Cloudinary adapter, media cleanup, cursor helpers và recommendation provider interface.
- MailModule/MailService độc lập. Chưa nối vào PasswordRecoveryService, SMTP/auth hiện có giữ nguyên.
- Provider khung được đăng ký ở module sở hữu, không có fake recommendation provider.
- Service chưa cần dependency không có constructor injection giả; imports/exports module đã chuẩn bị, sẽ bổ sung injection khi triển khai logic thực tế.

## API mới

| Method | Route | Input |
| --- | --- | --- |
| POST | /media/upload-signature | body purpose: avatar |
| GET | /profile/me | — |
| GET | /profile/:userId | UUID |
| PATCH | /profile/me | fullName?, bio?, dateOfBirth? |
| POST | /profile/me/avatar/complete | uploadId UUID |
| DELETE | /profile/me/avatar | — |
| POST | /friends/requests | receiverId UUID |
| GET | /friends/requests | direction: incoming/outgoing; pagination |
| POST | /friends/requests/:requestId/accept | UUID |
| POST | /friends/requests/:requestId/reject | UUID |
| DELETE | /friends/requests/:requestId | UUID |
| GET | /friends | pagination |
| DELETE | /friends/:userId | UUID |
| GET | /users | q: 2–100 ký tự; pagination |
| POST | /posts | content: 1–5000 ký tự; privacy?: public/friends/only_me |
| GET | /posts | authorId UUID; pagination |
| GET | /posts/:postId | UUID |
| DELETE | /posts/:postId | UUID |
| GET | /feed | pagination |
| GET | /notifications | unreadOnly?: true/false; pagination |
| GET | /notifications/unread-count | — |
| PATCH | /notifications/read-all | — |
| PATCH | /notifications/:notificationId/read | UUID |

Pagination: limit mặc định 10, từ 1 đến 50; cursor tối đa 4096 ký tự. Chưa giải mã cursor vì helper chưa có logic.

## Hành vi hiện tại

- Thiếu/sai access token: 401 theo auth hiện có.
- Input sai cấu trúc/validation cơ bản: 400.
- Input hợp lệ và đã đăng nhập: **501 Not Implemented**, không trả success/dữ liệu giả.
- Exception filter hiện tại giữ envelope `success: false`, code `HTTP_ERROR` cho 501 và che thông báo 5xx. Chưa sửa filter dùng chung.
- Các hàm placeholder chỉ throw NotImplementedException, có output type để người triển khai tiếp nối. Tham số `_...` được cho phép chưa dùng bằng cấu hình ESLint ngay trong file khung, không nới lint toàn project.

Validation nghiệp vụ vẫn chưa có: trim/chuẩn hóa, body patch rỗng, ngày sinh tương lai, nội dung chỉ khoảng trắng, quyền sở hữu, privacy SQL, transition kết bạn, quota và xác minh Cloudinary. Không dùng khung làm API hoàn chỉnh hoặc production-ready.

## Chưa thực hiện

- SQL, schema, migration và kết nối DB mới; chỉ thêm alias transaction type từ Drizzle hiện có.
- Cloudinary/Resend SDK và dependency mới; chưa gọi mạng hoặc tạo chữ ký thật.
- Cleanup scheduler/command, webhook, realtime mới, ảnh bìa, sửa bài, API gửi mail/tạo notification công khai.
- Frontend, Swagger package hoặc thay auth contract.
- Gateway scaffold cũ được giữ nguyên, không coi là notifications realtime đã triển khai.

## Kiểm thử

- Unit tests controller được bổ sung provider và override guard trong test cô lập.
- `test/api-skeleton.e2e-spec.ts` boot toàn AppModule, mock database và verifier; guard JWT thực tế vẫn kiểm tra Bearer header. Không kết nối DB/provider ngoài.
- Test mỗi route với thiếu auth và input hợp lệ trả 501; test DTO/path/query validation, route /me, parsing unreadOnly=false và nullable profile fields.
- Các test này chỉ chứng minh wiring/contract khung, không chứng minh bảo mật nghiệp vụ hoặc transaction thực tế.

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```
