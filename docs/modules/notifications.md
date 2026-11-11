# Notifications — persistence và polling

[Mục lục và quy ước chung](README.md)

## Hiện trạng

`src/modules/notifications/` có controller/service/repository và response types; logic trả 501. NotificationsGateway chỉ là scaffold Hello world, **không phải realtime an toàn**. MVP dùng HTTP + polling, không thêm Socket.IO/broker trong task persistence.

## API hiện có

| API | Hàm | Output |
| --- | --- | --- |
| `GET /notifications` | listForUser | Page<NotificationResponseDto> |
| `GET /notifications/unread-count` | countUnread | `{ unreadCount }` |
| `PATCH /notifications/read-all` | markAllRead | `{ updatedCount, readThrough }` |
| `PATCH /notifications/:notificationId/read` | markRead | `{ id, isRead: true, unreadCount }` |

Query list: limit/cursor/unreadOnly, mặc định false; giữ parsing rõ `'false'` → false. Response actor là UserSummary hoặc null; type là string để đọc được record legacy. Không public API tạo notification.

## Dữ liệu và phụ thuộc

Schema hiện có recipientId, actorId, type, content, link, isRead, createdAt. `target` và `deduplicationKey` mới có ở types, **chưa có cột DB**. Đề xuất nullable target_type/target_id/deduplication_key và unique theo recipient + key khác null; audit và duyệt migration trước. Legacy không target vẫn đọc được; không đổi isRead thành readAt.

Notifications chỉ phụ thuộc Auth/Database, không import Friends/Posts ngược lại. Export NotificationsService, không export repository cho caller viết trực tiếp.

## Trình tự triển khai

1. Wire Database và implement NotificationsRepository.create hỗ trợ tx caller, uniqueness/upsert và trả `{ id, created }`.
2. `create`/`createInTransaction` bỏ self-notification; key ổn định cho retry cùng hành động, key khác cho hành động mới hợp lệ. Content/target do BE tạo, không tin link tùy ý từ client.
3. List luôn filter recipient, keyset createdAt + id, cursor bind unreadOnly và user; map actor deleted thành null, timestamp ISO.
4. Count từ DB isRead, không thêm counter RAM hoặc persisted counter dễ lệch.
5. MarkRead update có điều kiện recipientId; tài nguyên không sở hữu trả 404. Retry không tạo thay đổi thừa.
6. MarkAllRead chốt readThrough từ DB, UPDATE nguyên tử chỉ unread thuộc user và nằm trong mốc; ghi nhận rõ semantics giao dịch đồng thời. Notification mới sau mốc vẫn unread; test timestamp của transaction cạnh tranh, không mặc định timestamp tương đương thứ tự commit.
7. Friends gọi createInTransaction trong cùng transaction quan hệ. Không gọi mạng/provider trong transaction; nếu thêm realtime sau, emit chỉ sau commit.

Count là snapshot tại lúc đọc, FE phải resync định kỳ. Polling FE đề xuất 30–60 giây khi tab hoạt động; ngừng khi logout và refresh khi focus, chưa phải code BE đã triển khai.

## Kiểm thử nghiệm thu

Self suppression, duplicate key đồng thời, action mới có key mới, rollback với friend action, owner/nonowner, legacy actor/target, unreadOnly=false, retry mark-read, read-all cạnh tranh create và pagination. Unique/upsert/rollback cần DB integration, không chỉ mock.
