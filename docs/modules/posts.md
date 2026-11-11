# Posts — bài text và quyền xem

[Mục lục và quy ước chung](README.md)

## Hiện trạng và scope

`src/modules/posts/` có API/service/repository/types, tất cả nghiệp vụ còn 501. MVP chỉ tạo bài cá nhân text, groupId null. Chưa có PATCH/media/group API; không thêm chỉ vì schema có sẵn bảng/cột.

## API hiện có

| API | Service | Output |
| --- | --- | --- |
| `POST /posts` | createTextPost | 201 PostResponseDto |
| `GET /posts/:postId` | getVisiblePost | PostResponseDto |
| `GET /posts?authorId=<uuid>` | listVisibleByAuthor | Page<PostResponseDto> |
| `DELETE /posts/:postId` | deleteOwnPost | `{ id, deleted: true }` |

Create nhận content và privacy tùy chọn mặc định public. Sau trim content 1–5000 ký tự, giữ newline nội bộ; không nhận authorId/groupId/count từ FE. PostResponseDto gồm author summary, content nullable cho legacy, privacy, counts, timestamps và permissions. `canEdit` là UI hint, **không có nghĩa PATCH đã tồn tại**.

## Trình tự triển khai

1. Wire DrizzleService, dùng schema posts/users/friendships và repository hiện có.
2. Implement một `buildVisibilityPredicate(viewerId)` dùng chung detail/author/batch/latest: bài và author chưa xóa, groupId null, owner hoặc public hoặc friends với EXISTS friendship hợp lệ. only_me chỉ owner.
3. Create lấy author từ token, insert allowlist; toPostResponse chỉ xuất cột an toàn, không lộ email/hash.
4. Detail thiếu quyền/không tồn tại trả 404. Author list cần xác minh author tồn tại, áp dụng cùng predicate và keyset createdAt + id.
5. Delete update có điều kiện owner; retry chính author giữ deleted true. Hàm repository hiện chỉ trả boolean: nếu không phân biệt được missing/nonowner/already-deleted thì bổ sung truy vấn hoặc kiểu kết quả nội bộ, không suy diễn mọi false thành thành công.
6. `listVisibleByIds` batch bounded, bỏ bài không còn quyền; service trả lại theo thứ tự IDs ứng viên, tránh N+1.
7. `listLatestVisible` dùng asOf + after keyset cho Feed; export PostsService, không export repository cho Feed.

## Dữ liệu và quyết định

Counts hiện là cột persisted trên posts. Comments/Reactions cần chốt cập nhật atomic cùng mutation của chúng, không tự tăng ở luồng đọc. Duyệt index theo query thực tế; không tự mở group reads trước membership authorization. Authenticated public trong MVP không phải anonymous endpoint.

## Kiểm thử nghiệm thu

Ba privacy × owner/friend/stranger; unfriend làm mất quyền ngay; bài/author soft-delete và group bị loại khỏi mọi read path. Content trắng/quá dài, giả author, delete owner/nonowner/retry, batch đúng thứ tự và DTO không lộ private fields. DB integration cho keyset/count concurrency khi các module liên quan được triển khai.
