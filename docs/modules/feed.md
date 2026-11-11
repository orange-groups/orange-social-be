# Feed — latest và recommendation

[Mục lục và quy ước chung](README.md)

## Hiện trạng và contract

`GET /feed` → FeedService.getFeed(viewerId, query), yêu cầu Bearer, trả Page<PostResponseDto>. Viewer chỉ lấy token. `src/modules/feed/` có getRecommendedPage/getLatestPage, FeedCursor và RecommendationProvider interface; chưa có provider được bind hoặc endpoint gợi ý thật. Helper `utils/feed-cursor.ts` vẫn cần logic.

## Phụ thuộc và việc phải chốt

PostsService phải triển khai listLatestVisible/listVisibleByIds và visibility trước. Contract nội bộ provider hiện mô tả getCandidates nhận viewerId/limit/cursor/session, trả postIds/nextCursor/hasMore/session. Cần thống nhất với người sở hữu recommendation về timeout, giới hạn, snapshot/thứ tự, dedupe xuyên trang và cursor tiến; không bịa endpoint/SDK mới.

Latest-only là giai đoạn tạm/fallback, không gọi là hoàn thành recommendation.

## Trình tự triển khai

1. Implement cursor validate version=1, kind=feed, viewerId, mode, session/asOf và vị trí after/sourceCursor; giới hạn kích thước, UUID/ngày hợp lệ. Cursor khác viewer/mode hoặc hỏng trả 400.
2. Latest: chốt asOf ở trang đầu, truy vấn qua PostsService với createdAt/id keyset. Cursor giữ cùng mode/asOf cho các trang sau.
3. Recommended: validate candidate IDs và giới hạn batch, loại trùng trong batch, gọi PostsService.listVisibleByIds để recheck quyền sau recommendation rồi giữ thứ tự nguồn.
4. Refill có budget chốt trước, đề xuất tối đa 3 batch/request. Cursor phải tiến đúng phần đã tiêu thụ; không bỏ ứng viên hợp lệ chưa được trả. Không dùng Set một request để tuyên bố chống trùng toàn session.
5. Provider lỗi trang đầu có thể chọn latest; lỗi giữa recommended session trả 503 để retry, không âm thầm đổi thứ tự/mode.
6. Detect cursor không tiến, hasMore/nextCursor mâu thuẫn và loop provider; không tạo vòng refill vô hạn. Cho phép trang ít/không items nhưng nguồn còn nếu cursor vẫn tiến theo contract.

## Cấu hình và vận hành

Chưa có URL/token recommendation được chốt. Chỉ thêm env khi provider thật yêu cầu, không hardcode URL hoặc bind fake provider trả bài mẫu. Không fetch toàn bảng rồi sort trong RAM. Không tạo HTTP API recommendation nội bộ chỉ để hai service cùng app gọi nhau qua mạng.

## Kiểm thử nghiệm thu

Latest ổn định, timestamp trùng, malformed/cross-viewer cursor; provider timeout/duplicate/không tiến, refill budget và thứ tự. Bài bị xóa/đổi privacy/unfriend sau trang đầu phải được lọc lại. Test fallback trang đầu khác với lỗi giữa session và không bỏ ứng viên khi refill chạm page limit.
