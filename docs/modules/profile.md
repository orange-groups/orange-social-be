# Guide triển khai Profile

[Mục lục module](README.md) · [Upload avatar](media.md)

## 1. Module dùng để làm gì?

Xem/sửa hồ sơ và cập nhật avatar. Dùng bảng users, FriendsService để lấy quan hệ
và MediaService để xử lý ảnh. `GET /profile/me`, `PATCH /profile/me` và API
cập nhật avatar/ảnh bìa và xem hồ sơ công khai bên dưới đã triển khai.

### Cập nhật ảnh đại diện — POST /profile/me/avatar

- Yêu cầu Bearer token và `multipart/form-data`, chỉ một trường `file`
  (JPEG, PNG, WebP tối đa 2 MiB). Không nhận `userId`, `avatarUrl` hay `uploadId`.
- Backend upload Cloudinary rồi cập nhật `users.avatar_url` của user trong
  JWT. Thành công trả `200` và `{ "success": true, "data": { "avatarUrl": "https://..." } }`.
- Nếu Cloudinary lỗi, không ghi DB. Nếu DB không ghi được, không báo thành công.
  Chưa có cơ chế tự dọn ảnh cũ hoặc ảnh upload thành công nhưng ghi DB thất bại.
- UI hiển thị ảnh mới sau khi API trả thành công. Khi tải lại trang, ảnh
  lấy từ dữ liệu người dùng trả về lúc khôi phục phiên.

Không dùng `POST /profile/me/avatar/complete` cho luồng này. Route
`POST /media/avatar` cũ vẫn chỉ upload, không đổi ảnh đại diện.

## 2. Trình tự triển khai theo từng API

Mọi API dùng Bearer token. Giữ route `/me` trước `/:userId`.
Bài profile lấy qua Posts, không viết query bài trong Profile.

### API 1 — GET /profile/me

**Mục đích:** lấy hồ sơ của mình, gồm ngày sinh riêng tư.
**Input:** Bearer token, không body.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "<my-user-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null,
    "bio": null, "coverUrl": null, "friendCount": 0,
    "relationship": { "status": "self", "requestId": null },
    "createdAt": "2026-11-11T08:00:00.000Z", "dateOfBirth": "2003-05-20"
  }
}
```

- [ ] Controller/service
  - [ ] Lấy user từ JWT, gọi `getMyProfile()` và query allowlist user chưa soft-delete.
  - [ ] Lấy count/relationship thật qua FriendsService, không trả hash/token/email trong profile.
  - [ ] Map dateOfBirth theo YYYY-MM-DD/UTC nhất quán với cột timestamp hiện tại.
- [ ] FE và kiểm thử
  - [ ] Điền form bằng dữ liệu thật; test missing/deleted user và count/relationship.

### API 2 — GET /profile/:userId

**Input:** Bearer token và `userId` UUID trên path, không body. UUID sai trả
`400`; tài khoản không tồn tại hoặc đã xóa trả `404`.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "<other-user-uuid>", "username": "binh", "fullName": "Trần Bình", "avatarUrl": null,
    "bio": "Xin chào!", "coverUrl": null, "friendCount": 1,
    "relationship": { "status": "friends", "requestId": null },
    "createdAt": "2026-11-11T08:00:00.000Z"
  }
}
```

- Không trả email, ngày sinh hay dữ liệu xác thực, kể cả chủ hồ sơ mở link này.
- `relationship` đọc từ dữ liệu hiện có: `self`, `none`, `friends`,
  `outgoing_request`, `incoming_request`. Nếu có hai lời mời chờ theo hai chiều
  thì dùng lời mời cũ hơn; quan hệ bạn bè được ưu tiên hơn lời mời.
- UI mở liên kết `/profile/:userId` sau khi đăng nhập. Chủ hồ sơ lấy link qua
  nút **Sao chép liên kết hồ sơ**. Trang hiển thị chỉ đọc, có mục **Bài viết
  công khai** lấy từ Posts; chưa có hành động kết bạn.

### API 3 — PATCH /profile/me

**Mục đích:** sửa thông tin được cho phép, không thay định danh đăng nhập.

Bỏ qua trường nào thì giữ nguyên trường đó. Gửi `null` để xóa `bio` hoặc
`dateOfBirth`; `bio` chỉ có khoảng trắng cũng được xóa. Ngày sinh không được
ở tương lai (theo UTC). Email vẫn lấy từ phiên đăng nhập, không sửa qua API này.

**Input:**

```json
{ "fullName": "Nguyễn An", "bio": "Giới thiệu mới", "dateOfBirth": "2003-05-20" }
```

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "<my-user-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null,
    "bio": "Giới thiệu mới", "coverUrl": null, "friendCount": 0,
    "relationship": { "status": "self", "requestId": null },
    "createdAt": "2026-11-11T08:00:00.000Z", "dateOfBirth": "2003-05-20"
  }
}
```

- [ ] Controller/DTO
  - [ ] Chỉ nhận fullName/bio/dateOfBirth; body rỗng trả 400.
  - [ ] Trim fullName 1–150, không null; bio tối đa 200, rỗng thành null.
  - [ ] Ngày lịch hợp lệ, không tương lai; missing giữ nguyên, null chỉ xóa field nullable.
- [ ] Service/database
  - [ ] `updateProfile()` UPDATE theo user từ JWT và allowlist, updatedAt do BE đặt.
  - [ ] Không nhận email/username/password/avatarUrl/coverUrl qua PATCH này.
- [ ] FE và kiểm thử
  - [ ] Giữ input khi lưu lỗi; success đồng bộ profile/header và auth user.
  - [ ] Test null/missing/trim/ngày sai/body rỗng, giả user và field không được phép.
  - [ ] Kiểm tra `/auth/me` trả tên mới sau lưu.

### API 4 — POST /profile/me/avatar/complete

**Input:**

```json
{ "uploadId": "<upload-uuid>" }
```

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "avatarUrl": "https://res.cloudinary.com/your_cloud_name/image/upload/avatar.jpg" } }
```

- [ ] Controller/service
  - [ ] Validate uploadId, gọi `completeAvatarUpload()`; verify owner/purpose/hạn/metadata qua Media ngoài transaction.
  - [ ] Khóa user rồi session, recheck/attach, đổi URL/reference và scheduleCleanup ảnh cũ cùng transaction.
  - [ ] Complete lặp chỉ an toàn nếu ảnh vẫn gắn đúng profile; không hồi sinh ảnh đã thay/xóa.
- [ ] FE và kiểm thử
  - [ ] Không tin URL FE tự gửi; lỗi giữ ảnh cũ, success đồng bộ header/auth user.
  - [ ] Test sai owner, hết hạn, complete đồng thời, rollback và reload theo [Media](media.md).

### API 5 — DELETE /profile/me/avatar

**Input:** Bearer token, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "avatarUrl": null } }
```

- [ ] Controller/service
  - [ ] Gọi `removeAvatar()`, khóa cùng thứ tự complete; xóa URL/reference và scheduleCleanup trong transaction.
  - [ ] Retry vẫn trả null; lỗi cleanup provider không đảo ngược profile đã commit.
- [ ] FE và kiểm thử
  - [ ] Hiện avatar mặc định sau success; test retry, delete-vs-complete và ảnh còn reference.

### Cập nhật ảnh bìa — POST /profile/me/cover

- Yêu cầu Bearer JWT và `multipart/form-data` với đúng một trường tệp `file`.
  Hỗ trợ JPEG, PNG, WebP tối đa 5 MiB. Không nhận `userId` hoặc `coverUrl` từ client.
- Backend tải ảnh lên Cloudinary và lưu URL HTTPS vào `users.cover_url` của
  tài khoản đang đăng nhập (chưa bị xóa). Không cần migration hay preset mới.
- HTTP `200`: `{ "success": true, "data": { "coverUrl": "https://..." } }`.
  Khi tải lại trang, `GET /profile/me` trả `coverUrl` đã lưu.
- Lỗi: `400` thiếu file hoặc dư trường, `401` chưa đăng nhập, `404` không tìm
  thấy hồ sơ đang hoạt động, `413` quá dung lượng, `415` sai định dạng, `502`
  lỗi Cloudinary, `503` thiếu cấu hình Cloudinary.
- Chưa tự động xóa ảnh cũ hoặc ảnh đã upload nhưng không lưu được vào DB.

## 3. Nghiệm thu

- [ ] Reload giữ thông tin/ảnh mới, public profile không lộ ngày sinh hoặc private fields.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module), ghi kết quả và giới hạn chưa triển khai.
