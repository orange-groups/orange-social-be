# Guide triển khai Posts

[Mục lục module](README.md)

## 1. Module dùng để làm gì?

Đã triển khai đăng bài cá nhân (chữ, ảnh, video), liệt kê bài của chính mình
và liệt kê bài công khai của một tác giả. API chi tiết và xóa vẫn là skeleton.

## 2. Trình tự triển khai theo từng API

Mọi API yêu cầu Bearer. Privacy giữ `public | friends | only_me`; public trong
MVP vẫn yêu cầu đăng nhập. Counts là dữ liệu persisted, không tự tăng khi đọc.

### API 1 — POST /posts

**Mục đích:** đăng bài của người hiện tại. Mọi bài mới có `privacy: "public"` do
server đặt; không nhận `privacy`, `authorId`, `groupId` hay URL media từ client.

**Input:** `multipart/form-data`, trường `content` không bắt buộc, đính kèm
qua các trường tệp cùng tên `files`. Có thể gửi `application/json` với
`content` nếu chỉ đăng chữ.

- Nội dung được trim, giữ xuống dòng, tối đa 5.000 ký tự. Chấp nhận bài chỉ có
  tệp (trả `content: null`); từ chối nếu không có cả chữ lẫn tệp.
- Tối đa 4 ảnh JPEG/PNG/WebP (5 MiB/ảnh) và 1 video MP4/WebM, tổng tối đa 20 MiB.
- Backend tải tệp lên Cloudinary, sau đó lưu bài và các tệp theo thứ tự gửi
  trong cùng transaction PostgreSQL. Dùng các bảng hiện có, không cần migration.

**Output — HTTP `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "<post-uuid>",
    "author": { "id": "<my-user-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null },
    "content": "Xin chào mọi người!", "media": [], "privacy": "public", "reactionCount": 0, "commentCount": 0,
    "createdAt": "2026-11-11T08:00:00.000Z", "updatedAt": "2026-11-11T08:00:00.000Z",
    "permissions": { "canEdit": false, "canDelete": false }
  }
}
```

Mỗi mục `media` có `id`, `type` (`image` hoặc `video`) và `url` HTTPS. Chưa
tự động dọn tệp đã upload nếu một file sau đó hoặc DB gặp lỗi.

### API — GET /posts/me

Liệt kê bài cá nhân chưa xóa của tài khoản trong JWT, mới nhất trước.
Query `limit` mặc định 10, tối đa 50; `cursor` lấy từ `nextCursor` của lượt
trước. Trả `200` với `data: { items, nextCursor, hasMore }`, mỗi bài có cùng
kiểu với response tạo bài. Mục **Bài viết của tôi** dùng endpoint này; bảng
tin chưa sử dụng bài đã đăng.

### API 2 — GET /posts/:postId

**Input:** postId UUID trên path, không body.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "<post-uuid>",
    "author": { "id": "<author-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null },
    "content": "Xin chào mọi người!", "privacy": "public", "reactionCount": 2, "commentCount": 1,
    "createdAt": "2026-11-11T08:00:00.000Z", "updatedAt": "2026-11-11T08:00:00.000Z",
    "permissions": { "canEdit": false, "canDelete": false }
  }
}
```

- [ ] Controller/service
  - [ ] Validate ID, gọi `getVisiblePost(viewerId, postId)`.
  - [ ] Dùng chung `buildVisibilityPredicate()`: bài/author chưa xóa, groupId null, owner/public/friend hợp lệ; only_me chỉ owner.
  - [ ] Thiếu quyền hoặc không tồn tại cùng trả 404; permissions chỉ để FE hiển thị.
- [ ] FE và kiểm thử
  - [ ] Test ba privacy × owner/friend/stranger; unfriend mất quyền ngay, deleted/group bị loại.

### API 3 — GET /posts?authorId=<uuid>

**Mục đích:** danh sách bài công khai của một tác giả trên hồ sơ, kể cả khi
chủ hồ sơ mở liên kết chia sẻ của mình.

**Input — query:**

```json
{ "authorId": "<author-uuid>", "limit": 10, "cursor": null }
```

Query qua URL, authorId bắt buộc, bỏ cursor trang đầu; limit tối đa 50.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "<post-uuid>",
        "author": { "id": "<author-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null },
        "content": "Xin chào!", "media": [], "privacy": "public", "reactionCount": 0, "commentCount": 0,
        "createdAt": "2026-11-11T08:00:00.000Z", "updatedAt": "2026-11-11T08:00:00.000Z",
        "permissions": { "canEdit": false, "canDelete": false }
      }
    ],
    "nextCursor": null, "hasMore": false
  }
}
```

- Tác giả không tồn tại hoặc đã xóa trả `404`.
- Chỉ trả bài cá nhân chưa xóa có `privacy = public`; không trả bài nhóm,
  `friends` hay `only_me`. Sắp xếp mới nhất trước theo `createdAt` và ID.
- `cursor` là `nextCursor` của trang trước và chỉ phân trang trong danh sách
  công khai của cùng tác giả.

### API 4 — DELETE /posts/:postId

**Input:** postId UUID trên path, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "id": "<post-uuid>", "deleted": true } }
```

- [ ] Controller/service
  - [ ] Gọi `deleteOwnPost()` với user JWT; soft-delete có predicate owner ở DB.
  - [ ] Phân biệt missing/nonowner/already-deleted, không coi mọi repository false là success.
  - [ ] Retry bởi chính tác giả giữ deleted true; người khác không được xóa.
- [ ] FE và kiểm thử
  - [ ] Success loại bài khỏi list/detail; request lỗi giữ dữ liệu và thông báo lỗi.
  - [ ] Test owner/nonowner/retry, bài đã xóa không xuất hiện ở feed/profile/detail.

## 3. Hàm nội bộ và nghiệm thu

- [ ] `listVisibleByIds()` bounded/batch, lọc quyền và giữ thứ tự IDs cho Feed.
- [ ] `listLatestVisible()` dùng asOf + keyset; export PostsService, không export repository cho Feed.
- [ ] Test batch không N+1 và DB keyset; Comments/Reactions phải cập nhật counts atomic với mutation khi triển khai.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module), ghi kết quả và giới hạn còn lại.
