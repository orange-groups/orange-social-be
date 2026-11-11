# Friends — lời mời và quan hệ bạn bè

[Mục lục và quy ước chung](README.md)

## Hiện trạng và dữ liệu

`src/modules/friends/` có controller/service/repository/types nhưng chưa có SQL/nghiệp vụ. Phụ thuộc Auth, Database và NotificationsService có persistence thật.

Schema có friend_requests (senderId, receiverId, status) và friendships PK(userId, friendId). Pending unique hiện chỉ cùng chiều. Đề xuất unique pending trên cặp không thứ tự LEAST/GREATEST; audit lời mời ngược chiều trước migration, không tự xóa record xung đột. Mô hình hai friendship rows đối xứng phải xác nhận với DB thật.

## API hiện có

| API | Hàm | Kết quả |
| --- | --- | --- |
| `POST /friends/requests` | sendRequest | 201 FriendRequestResponseDto; body receiverId |
| `GET /friends/requests` | listRequests | Page<FriendRequestItemDto>; direction incoming/outgoing bắt buộc |
| `POST /friends/requests/:requestId/accept` | acceptRequest | 200 accepted + friend |
| `POST /friends/requests/:requestId/reject` | rejectRequest | 200 rejected |
| `DELETE /friends/requests/:requestId` | cancelRequest | cancelled |
| `GET /friends` | listFriends | Page<FriendItemDto> |
| `DELETE /friends/:userId` | removeFriend | userId + relationship none |

Requests list chỉ pending, user trong item là người đối diện. ID validate UUID, actor lấy token. Relationship export: self/none/outgoing_request/incoming_request/friends + requestId nullable.

## Trình tự triển khai

1. Wire DB và repository hiện có; mọi đường ghi khóa cặp users cùng thứ tự UUID tăng dần, rồi khóa request/recheck state. Không SELECT rồi INSERT ngoài transaction.
2. Send: chặn self/user missing hoặc soft-delete/đã là bạn/pending cả hai chiều; insert request và notification received trong cùng transaction. Gửi chéo trả 409, không tự accept.
3. Accept: chỉ receiver; pending → accepted, insert hai friendship rows và notification accepted atomically. Retry khi vẫn friends trả kết quả accepted, không tạo lại notification; request cũ không hồi sinh tình bạn đã bị xóa.
4. Reject: chỉ receiver; cancel: chỉ sender. Kiểm tra trạng thái pending, conflict trả 409; không phát notification mới.
5. RemoveFriend: khóa pair, xóa cả hai chiều; retry trả none, không sửa lịch sử accepted.
6. Implement getRelationship/getRelationships/areFriends/countFriends để Profile/Users dùng. Batch getRelationships chưa có hàm repository riêng: bổ sung nếu cần, không gọi query từng user.
7. Pagination requests dùng createdAt + requestId; friends dùng friendsSince + ID đối diện, cursor bind user/direction/kind, luôn giới hạn query.

Không có block module/contract hiện tại; không tự dựng block API. Nếu bổ sung phải chốt ảnh hưởng đến request, reads và visibility.

## Kiểm thử nghiệm thu

Self/missing/deleted, gửi trùng và chéo đồng thời, sai actor, transition không hợp lệ, accept lặp và accept-vs-unfriend. DB integration xác minh lock order, unique pair, hai hàng đối xứng, rollback notification + relation và cursor khi timestamp trùng. Mock không chứng minh an toàn đồng thời.
