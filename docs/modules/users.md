# Users — tìm kiếm người dùng

[Mục lục và quy ước chung](README.md)

## Hiện trạng và contract

`src/modules/users/` có UsersController.search → UsersService.searchUsers, SearchUsersDto và UserSearchResponseDto. Service chưa triển khai. Module đã import Auth/Friends, cần wire DB khi viết query.

`GET /users?q=nguyen&limit=10&cursor=...` yêu cầu Bearer, trả `Page<UserSearchResponseDto>`. Item là UserSummary + relationship; không dùng AuthUserDto vì có email.

## Trình tự triển khai

1. Normalize q bằng trim rồi kiểm tra 2–100 ký tự; thiếu/rỗng trả 400, không biến API thành list mọi tài khoản.
2. Tìm không phân biệt hoa thường trên fullName/username bằng query parameterized; nếu semantics là tìm literal thì escape `%`, `_` và escape character của ILIKE. Không tìm email công khai.
3. Bỏ users soft-delete; chốt có loại chính viewer khỏi kết quả hay không trước nghiệm thu.
4. Keyset createdAt DESC + id DESC, lấy limit+1; cursor bind q đã normalize và ngữ cảnh viewer khi cần. Cursor filter khác trả 400.
5. Gọi FriendsService.getRelationships một batch cho các IDs trong trang; không query relationship từng user.
6. Map allowlist id/username/fullName/avatarUrl/relationship. Chỉ thêm repository nếu query đủ phức tạp, không tạo layer rỗng.

## Dữ liệu/cấu hình

Dùng users và friendship/request hiện có. Không cần provider ngoài hay env riêng. Xem query plan trước khi đề xuất search index/extension; thêm index là migration cần review, không tự cài extension DB.

## Kiểm thử nghiệm thu

q thiếu/trắng/ngắn/dài, Unicode và case-insensitive; wildcard/literal và SQL injection; không trả email/ngày sinh/hash/deleted user. Kiểm tra cả năm trạng thái relationship, không N+1, thứ tự khi timestamp trùng và cursor khác q/viewer theo contract đã chốt.
