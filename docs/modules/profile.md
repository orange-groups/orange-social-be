# Profile — hồ sơ và avatar

[Mục lục và quy ước chung](README.md)

## Hiện trạng và phụ thuộc

`GET /profile/me` và `PATCH /profile/me` đã triển khai. Các route hồ sơ công khai và avatar trong bảng dưới vẫn trả `501`. Xem [dev note](../dev-note.md) cho luồng cập nhật thông tin cá nhân.

## API hiện có

| API | Service | Kết quả trong data |
| --- | --- | --- |
| `GET /profile/me` | getMyProfile | MyProfileResponseDto |
| `GET /profile/:userId` | getProfile | ProfileResponseDto |
| `PATCH /profile/me` | updateProfile | MyProfileResponseDto |
| `POST /profile/me/avatar/complete` | completeAvatarUpload | 200 `{ avatarUrl }` |
| `DELETE /profile/me/avatar` | removeAvatar | `{ avatarUrl: null }` |

ProfileResponseDto gồm UserSummary, bio, coverUrl, friendCount, relationship, createdAt. Chỉ MyProfileResponseDto thêm dateOfBirth dạng YYYY-MM-DD; kể cả người gọi là owner, route public không cần tiết lộ ngày sinh. Giữ `/me` trước `/:userId`.

## Trình tự triển khai

1. Inject DrizzleService qua DatabaseModule khi thực sự dùng. Query allowlist users chưa soft-delete; không dùng SELECT toàn bộ user làm response.
2. Gọi FriendsService.getRelationship/countFriends qua contract export. Không đặt query posts trong Profile; danh sách bài thuộc `GET /posts?authorId=...`.
3. PATCH chỉ cho fullName/bio/dateOfBirth; missing giữ nguyên, null xóa nullable field, fullName null bị từ chối. Trim fullName 1–150; bio tối đa 200, rỗng chuẩn hóa null. Ngày lịch hợp lệ không tương lai; cột DB hiện là timestamp nên mapping ngày phải thống nhất UTC. Body rỗng trả 400.
4. Không nhận email/username/password/avatarUrl/coverUrl qua generic PATCH; updatedAt do BE cập nhật.
5. Complete avatar: verify qua Media ngoài transaction; mở transaction khóa user rồi session theo thứ tự thống nhất, attach/recheck, thay URL/reference và scheduleCleanup ảnh cũ trong cùng commit.
6. Remove avatar: khóa cùng thứ tự, xóa URL/reference và scheduleCleanup; retry giữ kết quả null. Cleanup provider lỗi không đảo ngược profile đã commit.

## Dữ liệu và quyết định còn mở

Text profile dùng users hiện có, không tự tạo ProfileRepository chỉ để bọc query đơn giản. Avatar cần migration media session + avatar reference được duyệt ở [media.md](media.md). Cover API chưa có, không mở rộng chỉ vì coverUrl tồn tại.

## Kiểm thử nghiệm thu

- Missing/null/trim/body rỗng/ngày tương lai hoặc không tồn tại; private fields không xuất ở profile public.
- User không tồn tại/soft-delete; relationship và count thật, không N+1 trong các luồng batch.
- Avatar sai owner/hết hạn/lặp; thay đồng thời, rollback, cleanup failure và remove idempotent.
- `/auth/me` trả tên/avatar mới; không thay auth response/session strategy.
