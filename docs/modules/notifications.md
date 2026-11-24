# Guide triển khai Notifications

[Mục lục module](README.md)

## 1. Module dùng để làm gì?

Lưu thông báo trong PostgreSQL, hiển thị danh sách và đồng bộ số chưa đọc.
HTTP đọc/ghi trạng thái; Socket.IO báo cho ứng dụng tải lại dữ liệu thật.
Gửi và chấp nhận lời mời kết bạn tạo thông báo trong cùng transaction. `post_reacted` và
`post_commented` có loại dữ liệu và hàm nội bộ, nhưng chưa có luồng react/bình
luận lưu DB để gọi hàm đó.

### Kết nối thời gian thực

- Socket.IO v4, transport WebSocket, path `/notifications/socket.io`.
  Gửi access token trong `auth.accessToken`, không truyền qua query string;
  origin trình duyệt phải khớp `FRONTEND_URL`.
- Server tự chọn phòng từ user trong JWT. `notifications:changed` không có
  payload nhạy cảm; client tải lại số chưa đọc và danh sách qua REST. Khi
  token hết hạn, socket ngắt; client dùng luồng refresh hiện có để nối lại.
- Client tải lại khi kết nối, khi quay lại tab, và định kỳ 45 giây khi tab mở
  nhưng socket mất kết nối. Không phát Web Push khi đóng tab.
- Reverse proxy cần chuyển tiếp WebSocket Upgrade tại path trên. Phòng hiện
  nằm trong tiến trình; chạy nhiều instance cần Socket.IO adapter chung để
  chuyển sự kiện giữa các instance.

## 2. Trình tự triển khai theo từng API

Các API đều yêu cầu Bearer token. Actor có thể null khi user bị xóa. Target
được mã hóa vào cột `link` hiện có; link cũ không hợp lệ trả `target: null`.
Thông báo mới dùng ID cố định theo người nhận, loại và ID sự kiện; khóa chính
chống tạo trùng khi retry. Không cần migration cho luồng hiện tại.

### API 1 — GET /notifications

**Mục đích:** lấy thông báo của chính mình, có phân trang.

**Input — query:**

```json
{ "limit": 10, "cursor": null, "unreadOnly": false }
```

Query truyền qua URL; bỏ cursor ở trang đầu. Limit tối đa 50.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "<notification-uuid>",
        "type": "friend_request_received",
        "actor": { "id": "<user-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null },
        "content": "Nguyễn An đã gửi lời mời kết bạn.",
        "target": { "type": "friend_request", "id": "<request-uuid>" },
        "isRead": false,
        "createdAt": "2026-11-11T08:00:00.000Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  }
}
```

- [ ] Controller
  - [ ] Validate query; parse chuỗi `'false'` thành false, không dùng Boolean('false').
- [ ] Service/database
  - [ ] `listForUser()` luôn filter recipient từ JWT.
  - [ ] Keyset createdAt + id, cursor bind user/unreadOnly; map actor/target legacy an toàn.
  - [ ] Chỉ trả DTO allowlist, không lộ dữ liệu riêng của actor.
- [ ] FE và kiểm thử
  - Dùng Socket.IO để đồng bộ; polling chỉ là dự phòng khi mất kết nối.
  - [ ] Test ownership, legacy, unreadOnly=false và pagination; target mất quyền phải xử lý an toàn khi mở.

### API 2 — GET /notifications/unread-count

**Input:** Bearer token, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "unreadCount": 3 } }
```

- [ ] Controller/service
  - [ ] Gọi `countUnread()` cho user hiện tại.
  - [ ] Đếm trực tiếp DB theo recipient/isRead, không dùng counter RAM dễ lệch.
- [ ] FE và kiểm thử
  - [ ] Badge resync cùng danh sách; count chỉ là snapshot lúc truy vấn.
  - [ ] Test count rỗng và không tính thông báo người khác.

### API 3 — PATCH /notifications/:notificationId/read

**Input:** notificationId UUID trên path, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "id": "<notification-uuid>", "isRead": true, "unreadCount": 2 } }
```

- [ ] Controller/service
  - [ ] Validate ID, gọi `markRead()` với user từ JWT.
  - [ ] UPDATE có điều kiện recipient; không sở hữu/missing trả 404.
  - [ ] Gọi lặp không giảm count hai lần; trả count được tính lại.
- [ ] FE và kiểm thử
  - [ ] Đồng bộ item và badge; test owner/nonowner/missing/retry.

### API 4 — PATCH /notifications/read-all

**Input:** Bearer token, không body. Giữ route cố định trước route có ID.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "updatedCount": 3, "readThrough": "2026-11-11T08:05:00.000Z" } }
```

- [ ] Controller/service
  - [ ] Gọi `markAllRead()`, chốt readThrough từ DB.
  - [ ] UPDATE nguyên tử unread của user tới mốc; thông báo mới sau mốc vẫn unread.
  - [ ] Chốt/test semantics transaction đồng thời; timestamp không tự là thứ tự commit.
- [ ] FE và kiểm thử
  - [ ] Resync list/count, không mặc định count luôn bằng 0 khi có thông báo mới.
  - [ ] Test gọi lặp và create cạnh tranh read-all trên DB cô lập.

## 3. Hàm nội bộ — Tạo thông báo

Không mở API tạo notification public.

- [ ] Implement `create()`/`createInTransaction()` với caller transaction.
  - [ ] Recipient/actor/content/target do BE xác định; bỏ self-notification.
  - Dùng khóa chính xác định theo recipient + type + action ID; retry cùng
    hành động không trùng, hành động mới có ID mới.
  - [ ] Friends gọi service export trong cùng transaction quan hệ; không gọi mạng trong transaction.
- [ ] Test uniqueness/upsert và rollback cùng friend action trên DB, không chỉ mock.

## 4. Nghiệm thu

- [ ] Lời mời tạo thông báo thật; đọc cập nhật badge, reload không mất dữ liệu.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module); chưa bật realtime ngoài scope.
