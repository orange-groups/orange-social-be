# Comments — kế hoạch chờ chốt contract

[Mục lục và quy ước chung](README.md)

## Hiện trạng

`src/modules/comments/` chỉ có controller/service rỗng và module registration, **chưa có REST endpoint, DTO hoặc service contract**. Phần dưới là định hướng cần duyệt, không phải API đã triển khai.

Schema comments đã có postId/authorId/parentId/rootId/depth/content/reactionCount/timestamps/deletedAt; depth bị ràng buộc 0–2. Có bảng comment_mentions/comment_reactions, nhưng sự tồn tại của bảng không tự phê duyệt tính năng mention/reaction.

## Cần chốt trước khi code

- Route/method/DTO/status cho create, list, replies, edit, delete và pagination; không mặc định các route trong FE là contract BE.
- Giới hạn content sau trim; thứ tự list gốc/replies và có trả count/reaction người xem hay không.
- Semantics xóa: tombstone hay ẩn cả subtree; count gồm replies hay chỉ root; quyền tác giả bài đối với comment của người khác.
- Quan hệ parent/root và cách trình bày depth tối đa 2; có hỗ trợ mention/notification trong scope không.

## Trình tự đề xuất sau duyệt

1. Thêm DTO/types và controller handlers theo contract đã chốt; AuthModule/Database/PostsService dependencies phải wire rõ ràng.
2. Trước mọi read/write, kiểm tra bài còn tồn tại/visible qua PostsService; không tạo predicate riêng lệch với Posts. Với write, thiết kế transaction/lock để quyền hoặc trạng thái parent không đổi giữa check và mutation theo mức nhất quán đã chốt.
3. Author từ token; parent phải thuộc cùng post, còn hợp lệ, không vượt depth. rootId/depth do BE tính, không tin FE tự khai.
4. Insert/edit/delete allowlist, ownership predicate ở DB; soft-delete theo semantics đã duyệt, không dựa vào FK cascade cho soft-delete.
5. Nếu cập nhật posts.commentCount persisted, mutation và delta phải atomic trong cùng transaction, idempotent retry không tăng/giảm hai lần; thống nhất ownership contract với Posts.
6. Pagination bounded, stable keyset cho từng danh sách; join/batch author summary, không lộ email/hash.
7. Chỉ tạo notification/mentions khi contract được mở rộng rõ ràng; emit sau commit nếu có realtime sau này.

## Dữ liệu/cấu hình và kiểm thử

Không cần provider/env riêng. Index/migration chỉ đề xuất sau query thật. Test ba privacy của parent post, same-post parent, depth 0–2, actor giả, sửa/xóa không phải owner, deleted parent/post, retry và pagination. DB integration cho count rollback và edit/delete/reply đồng thời. Viết unit/e2e thật khi triển khai, không phục hồi test chỉ kiểm tra defined.
