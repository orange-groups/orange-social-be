# Chat — kế hoạch chờ contract và schema

[Mục lục và quy ước chung](README.md)

## Hiện trạng

`src/modules/chat/` có controller/service rỗng, ChatGateway trả Hello world cho event mẫu `message` bằng tham số any. Đây **không phải tính năng chat đã chạy an toàn**; không tái sử dụng event mẫu như production contract.

`src/database/schema.ts` hiện không có conversations/members/messages. Cần duyệt schema và contract trước khi triển khai; không trả lịch sử tin nhắn giả.

## Các quyết định bắt buộc

- MVP chat một-một hay group; ai được mở conversation/gửi tin, quy tắc sau unfriend/block nếu có.
- REST routes/DTO cho list conversation/history, Socket.IO namespace/events/ack/errors, handshake credential và token-expiry behavior.
- Schema conversation/membership/message; PK/FK/index, retention/deletion, trạng thái delivered/read và last-read marker.
- Ordering/cursor, clientMessageId hoặc idempotency key và uniqueness theo sender/conversation; retry/reconnect có phát lại thế nào.
- Có media không; media riêng tư không được dùng mặc định avatar Public preset.

## Trình tự đề xuất sau duyệt

1. Migration schema/index sau review, không thêm DDL startup hoặc chạy lên DB remote tự động.
2. Implement ChatService membership checks và persistence, sau đó mới bind controller/gateway. Query history bounded, order có tie-breaker rõ ràng.
3. Authenticate handshake bằng cơ chế xác minh token hiện có; lấy senderId từ credential, không payload. Xử lý token hết hạn/revocation và reconnect theo contract.
4. Validate DTO từng event; kiểm tra membership trên join/send/history/read và mọi hành động đặc quyền, không chỉ handshake. Server tự dựng room từ conversation hợp lệ, không join chuỗi room tùy ý của client.
5. Persist message và idempotency atomically trước broadcast/ack thành công. Sender/timestamp/order authoritative do server cấp; retry không tạo row mới.
6. Phát tin chỉ cho thành viên được phép sau commit; xử lý race thu hồi membership với room subscription, không coi việc đã join room là đủ quyền mãi mãi. Lỗi emit không rollback message đã lưu; client có thể resync lịch sử.
7. Last-read update monotonic theo message thuộc conversation; cleanup listeners/connections khi disconnect/logout, không đăng ký listener lặp.

## Cấu hình và vận hành

Không có env chat/provider contract mới được chốt. Kiểm tra hosting thực tế có hỗ trợ long-lived Socket.IO trước khi chọn deployment. Chỉ đề xuất Redis adapter khi có yêu cầu nhiều instance; Redis recovery hiện có không tự trở thành hạ tầng pub/sub chat. Không log nội dung private message/JWT.

## Kiểm thử nghiệm thu

Handshake sai/hết hạn, nonmember join/send/history/read, giả senderId/roomId, duplicate retry, ordering khi timestamp trùng, reconnect/resync và membership bị thu hồi. Unit mock transport, DB integration cho uniqueness/rollback/order, e2e dùng Socket.IO client tương thích chỉ sau khi duyệt dependency. Không dùng việc gateway compile được làm bằng chứng bảo mật.
