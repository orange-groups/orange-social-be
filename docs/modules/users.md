# Guide triển khai Users

[Mục lục module](README.md)

## 1. Module dùng để làm gì?

Tìm người dùng để xem hồ sơ hoặc kết bạn. Thanh tìm kiếm dẫn tới
`/search?q=...` và gọi `GET /users`. Không tìm bằng email.

## 2. Trình tự triển khai theo API

### API 1 — GET /users

**Mục đích:** tìm theo fullName/username, trả kèm quan hệ với người đang xem.
Yêu cầu Bearer token.

**Input — query:**

```json
{ "q": "nguyen", "limit": 10, "cursor": null }
```

Query truyền qua URL; bỏ cursor khi lấy trang đầu. `q` được trim, có thể bỏ
`@` ở đầu và dài 2–100 ký tự. `limit` mặc định 10, tối đa 50.

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "<user-uuid>",
        "username": "nguyenan",
        "fullName": "Nguyễn An",
        "avatarUrl": null,
        "relationship": { "status": "none", "requestId": null }
      }
    ],
    "nextCursor": null,
    "hasMore": false
  }
}
```

- Tìm chuỗi con bằng `strpos(lower(cột), lower(q))`: không phân biệt hoa
  thường, giữ nguyên dấu tiếng Việt, không có fuzzy matching hay xếp hạng.
  `%` và `_` là ký tự thường. SQL truyền từ khóa qua tham số.
- Loại tài khoản của người tìm và tài khoản đã xóa mềm. Chỉ trả thông tin
  công khai và quan hệ, không trả email, ngày sinh hoặc hash.
- Phân trang ổn định theo UUID tăng dần; lấy `limit + 1` để xác định
  `hasMore`. Cursor gắn với truy vấn và người tìm. Quan hệ được đọc theo batch.
- FE chỉ tìm khi submit, hủy request cũ khi đổi truy vấn và có nút
  **Xem thêm người dùng**. Bấm kết quả để mở `/profile/:userId`.

## 3. Nghiệm thu

- [ ] Tìm được user thật và nút quan hệ đúng hai chiều.
- [ ] Hoàn tất [checklist chung](README.md#checklist-hoàn-tất-mỗi-module), ghi kết quả và giới hạn chưa triển khai.
