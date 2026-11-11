# Reactions — kế hoạch chờ chốt contract

[Mục lục và quy ước chung](README.md)

## Hiện trạng

`src/modules/reactions/` chỉ có controller/service rỗng, chưa có route/DTO/hàm nghiệp vụ. Schema hỗ trợ **like | love**, không phải đầy đủ bộ reaction của Facebook.

post_reactions PK(postId,userId) và comment_reactions PK(commentId,userId) cho phép một reaction/user/target. posts/comments có reactionCount persisted. Không thêm haha/wow/sad/angry nếu chưa duyệt enum/migration và FE contract.

## Quyết định cần duyệt

- Route/method cho set/remove/list reactions, DTO output và status; semantics idempotent **set/remove** hay toggle. Đề xuất set/remove rõ ràng để retry không đảo trạng thái.
- Có hỗ trợ comment reactions ngay không; target reaction phải visible theo bài cha.
- Response có total/by-type/currentUserReaction không; cách đồng bộ feed/detail và UI optimistic rollback.
- Có notification trong scope không; NotificationType hiện chưa khai báo reaction events.

## Trình tự đề xuất sau duyệt

1. Wire Auth/Database/Posts và contract Comments khi hỗ trợ comment. Actor từ token, IDs/enum validate runtime.
2. Kiểm tra target và visibility ở mọi đường đọc/ghi, không chỉ lúc FE mở bài. Thiết kế transaction/lock/recheck nếu write cần nhất quán với delete/privacy thay đổi.
3. Upsert theo khóa target+user: cùng type không thay count; đổi type chỉ đổi reaction, total giữ nguyên.
4. Remove không tồn tại là no-op theo contract idempotent đã duyệt. Chỉ tăng/giảm count khi thực sự insert/delete, trong cùng transaction; không read-modify-write bằng count trong RAM.
5. Trả DTO allowlist và current user reaction nhất quán; thống nhất cách PostsService cung cấp dữ liệu feed/detail, không tự thêm field breaking mà không cập nhật contract.
6. Nếu có list, phân trang bounded, dùng batch user summary. Repository chỉ thêm khi SQL atomic/query tái sử dụng cần thiết.

## Kiểm thử nghiệm thu

Set lặp, đổi like↔love, remove lặp, target missing/deleted/private và user không có quyền. DB integration cho request set/remove đồng thời, PK uniqueness, counts không âm/không lệch và rollback. Không fake success/count khi chưa có persistence thật; không có env provider riêng cho MVP.
