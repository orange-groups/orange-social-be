# Guide triển khai Friends

[Mục lục module](README.md)

## 1. Module dùng để làm gì?

Quản lý lời mời và quan hệ bạn bè bằng PostgreSQL và JWT. Đã triển khai gửi,
thu hồi, chấp nhận và đọc danh sách bạn bè/lời mời. Từ chối, hủy kết bạn và
gợi ý chưa triển khai.

## 2. Trình tự triển khai theo từng API

Mọi API yêu cầu Bearer token; ID là UUID. Gửi lời mời khóa hai user theo UUID
tăng dần trước khi kiểm tra quan hệ. Thu hồi cập nhật có điều kiện theo ID,
người gửi và trạng thái `pending`. Không cần migration cho hai API này.

### API 1 — POST /friends/requests

**Mục đích:** gửi lời mời cho người khác.

**Input:**

```json
{ "receiverId": "<receiver-uuid>" }
```

**Output — HTTP `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "<request-uuid>", "senderId": "<sender-uuid>", "receiverId": "<receiver-uuid>",
    "status": "pending", "createdAt": "2026-11-11T08:00:00.000Z", "updatedAt": "2026-11-11T08:00:00.000Z"
  }
}
```

- Từ chối tự gửi (`400`), người nhận không tồn tại/đã xóa (`404`), đã là bạn
  hoặc có lời mời chờ ở một trong hai chiều (`409`).
- Khóa cặp trong transaction trước khi đọc quan hệ, tạo request `pending`
  và lưu thông báo cho người nhận.
- FE đổi sang **Đã gửi lời mời** sau khi API thành công; đọc lại hồ sơ khi gặp `409`.

### API 2 — GET /friends/requests

**Input — query:**

```json
{ "direction": "incoming", "limit": 10, "cursor": null }
```

Direction bắt buộc incoming/outgoing; query qua URL, bỏ cursor trang đầu, limit tối đa 50.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [{ "id": "<request-uuid>", "user": { "id": "<other-user-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null }, "createdAt": "2026-11-11T08:00:00.000Z" }],
    "nextCursor": null, "hasMore": false
  }
}
```

- Chỉ lấy lời mời `pending` mà user hiện tại là người nhận hoặc gửi theo
  `direction`; loại người dùng đã xóa. `user` trong item là người đối diện.
- Phân trang mới nhất trước theo `createdAt` và request ID. Cursor ràng buộc
  người dùng và chiều. Trang Bạn bè hiển thị riêng mục nhận được và đã gửi.

### API 3 — POST /friends/requests/:requestId/accept

**Input:** requestId UUID trên path, không body.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": { "requestId": "<request-uuid>", "status": "accepted", "friend": { "id": "<sender-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null } }
}
```

- Chỉ người nhận được chấp nhận lời mời. Sai người hoặc không tìm thấy
  lời mời trả `404`; lời mời đã thu hồi hoặc không còn hợp lệ trả `409`.
- Backend khóa hai user rồi khóa lời mời, đổi `pending` thành `accepted`,
  lưu hai chiều kết bạn và tạo thông báo cho người gửi trong một transaction.
  Gọi lại khi hai người vẫn là bạn không tạo bản ghi hay thông báo trùng.
- FE hiện **Chấp nhận** trên hồ sơ người gửi và trong mục **Lời mời nhận
  được**. Thành công thì tải lại danh sách bạn bè hoặc hồ sơ.

### API 4 — POST /friends/requests/:requestId/reject

**Input:** requestId UUID trên path, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "requestId": "<request-uuid>", "status": "rejected" } }
```

- [ ] Controller/service
  - [ ] Gọi `rejectRequest()`; chỉ receiver và request pending.
  - [ ] Khóa/recheck state, transition rejected; conflict trả 409, không tạo notification.
- [ ] FE và kiểm thử
  - [ ] Xóa item sau success; test sender/người thứ ba không được reject và state conflict.

### API 5 — DELETE /friends/requests/:requestId

**Input:** requestId UUID trên path, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "requestId": "<request-uuid>", "status": "cancelled" } }
```

- Chỉ sender của request đang `pending` được thu hồi. Nếu request không thuộc
  sender hoặc không tồn tại, trả `404`; nếu không còn `pending`, trả `409`.
- Chuyển trạng thái sang `cancelled`, không xóa record, không tạo notification.
  FE hiện lại nút **Kết bạn** sau khi thu hồi thành công.

### API 6 — GET /friends

**Input — query:**

```json
{ "limit": 10, "cursor": null }
```

Query qua URL, bỏ cursor trang đầu; limit mặc định 10, tối đa 50.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [{ "id": "<friend-uuid>", "username": "an", "fullName": "Nguyễn An", "avatarUrl": null, "friendsSince": "2026-11-11T08:10:00.000Z" }],
    "nextCursor": null, "hasMore": false
  }
}
```

- Đọc `friendships` của user trong JWT theo chiều `user_id → friend_id`, cùng
  quy ước với số bạn bè trong hồ sơ. Loại người bạn đã xóa; không trả email.
- Phân trang mới nhất trước theo `friendsSince` và ID người bạn. Trang Bạn bè
  có trạng thái tải, lỗi, rỗng và nút **Xem thêm**.

### API 7 — DELETE /friends/:userId

**Input:** userId của người cần hủy kết bạn trên path, không body.

**Output — HTTP `200 OK`:**

```json
{ "success": true, "data": { "userId": "<friend-uuid>", "relationship": "none" } }
```

- [ ] Controller/service
  - [ ] Gọi `removeFriend()`; khóa cặp và xóa cả hai chiều trong transaction.
  - [ ] Gọi lại vẫn trả none; giữ lịch sử accepted, không tạo notification mới.
- [ ] FE và kiểm thử
  - [ ] Resync danh sách/profile; test retry và unfriend cạnh tranh accept.
  - [ ] Kiểm tra mất quyền xem bài friends ngay sau khi hủy kết bạn.

## 3. Hàm nội bộ và nghiệm thu

- [ ] Implement `getRelationship`/`getRelationships`/`areFriends`/`countFriends` cho Profile/Users; batch để tránh N+1.
- [ ] Trả đúng self/none/outgoing_request/incoming_request/friends và requestId nullable.
- [ ] Chạy DB integration lock order/unique pair/hai hàng đối xứng/rollback; mock không chứng minh concurrency.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module), ghi kết quả và giới hạn còn lại.
