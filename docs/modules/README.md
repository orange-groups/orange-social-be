# Checklist triển khai từng module BE

## Cách sử dụng checklist

- `[ ]`: việc chưa nghiệm thu; không có nghĩa code hoàn toàn chưa tồn tại.
- `[x]`: chỉ đánh dấu sau khi đối chiếu code, chạy kiểm tra và ghi bằng chứng.
- Mỗi guide bắt đầu bằng giới thiệu ngắn, sau đó triển khai theo từng API: mục đích → input → output JSON → checklist con controller/service/database/FE/kiểm thử.
- Không thêm bảng thành phần, danh sách file hoặc phần chuẩn bị dài nếu không cần. Đặt ràng buộc cần thiết ngay trong API liên quan.
- Mail mô tả hàm nội bộ, không tạo API gửi email public. Chat tách REST và socket; HTTP interceptor không tự bọc socket ack.
- JSON là ví dụ minh họa, không phải dữ liệu thật; `<...>` là placeholder phải thay bằng UUID/token/cursor hợp lệ khi thử. Query JSON chỉ mô tả các tham số URL, không phải GET body.
- API còn 501 chỉ có contract khung; output success là mục tiêu triển khai. Comments/Reactions/Chat chưa chốt contract phải ghi rõ đề xuất và duyệt trước khi viết code.
- Bảng API, hiện trạng và ràng buộc giữ vai trò tham chiếu; không tự coi một route/DTO khung là chức năng đã xong.
- Khi hoàn tất, ghi người thực hiện, commit, lệnh/kết quả kiểm tra và giới hạn còn lại ngay dưới checklist module.

Tài liệu bàn giao để triển khai nghiệp vụ, **không phải xác nhận các tính năng đã chạy** và không phải hướng dẫn chỉ deploy hosting. Đối chiếu mã nguồn trước mỗi task.

Đọc [AGENT_GUIDE](../AGENT_GUIDE.md), [API_SKELETON](../API_SKELETON.md) và `AGENTS.md` trước khi sửa code. Các hướng dẫn ở đây độc lập với file kế hoạch chưa được track ngoài `docs/`.

## Danh mục và hiện trạng

| Module | Hiện trạng | Hướng dẫn |
| --- | --- | --- |
| Auth | Có nghiệp vụ đăng ký/session/recovery qua Resend | [auth.md](auth.md) |
| Media | API, adapter và repository khung; chưa có SDK Cloudinary | [media.md](media.md) |
| Profile | API/DTO khung, service trả 501 | [profile.md](profile.md) |
| Notifications | API/repository khung; gateway mẫu chưa bảo mật | [notifications.md](notifications.md) |
| Friends | API/repository khung | [friends.md](friends.md) |
| Users | API tìm kiếm khung | [users.md](users.md) |
| Posts | API/repository/visibility khung | [posts.md](posts.md) |
| Feed | API và contract provider khung, chưa có provider thật | [feed.md](feed.md) |
| Mail | Resend Email API, đã nối khôi phục mật khẩu | [mail.md](mail.md) |
| Comments | Controller/service rỗng, chưa có endpoint | [comments.md](comments.md) |
| Reactions | Controller/service rỗng, chưa có endpoint | [reactions.md](reactions.md) |
| Chat | Controller/service rỗng, gateway Hello world | [chat.md](chat.md) |

Các module skeleton có route hợp lệ hiện trả **501**, không phải dữ liệu thành công. Comments/reactions/chat chưa có REST contract. Database/common/config là hạ tầng dùng chung, không phải module nghiệp vụ mới cần scaffold lại.

## Quy ước chung

- NestJS 11 + PostgreSQL + **Drizzle**. Dùng `DrizzleService` và `src/database/schema.ts`; không triển khai theo Prisma placeholder.
- Route chưa có prefix `/api/v1`. API nghiệp vụ phải import AuthModule và dùng JwtAuthGuard, actor lấy từ token.
- Controller trả dữ liệu bên trong `data`; interceptor bọc `{ success: true, data }`. Lỗi giữ envelope `{ success: false, error: { code, message, details } }` hiện tại.
- UUID cho ID; timestamp UTC ISO 8601; không trả hash/token/email/ngày sinh qua DTO công khai.
- Pagination: `{ items, nextCursor, hasMore }`, limit mặc định 10, tối đa 50; cursor tối đa 4096 ký tự. Implement helper cursor hiện có trước khi dùng: version/kind/filter/viewer binding khi phù hợp, validate payload và keyset thời gian + ID.
- `fullName`, `receiverId`, `recipientId`, privacy `public | friends | only_me` phải giữ đúng tên hiện tại.
- Service sở hữu quy tắc/quyền/transaction, repository sở hữu SQL. Gọi service export của module khác, không truy cập repository nội bộ của nhau.
- Chỉ inject dependency khi triển khai thật; bỏ/narrow ESLint allowance `_parameter` tại các hàm đã dùng tham số.

## Checklist thứ tự triển khai

- [ ] Chốt module được phép làm, DB thật, quy trình migration và các thay đổi cần duyệt.
- [ ] Hoàn thành cursor helpers và notifications persistence.
- [ ] Hoàn thành friends → users → profile text; posts và visibility có thể triển khai độc lập.
- [ ] Hoàn thành media + avatar profile sau khi duyệt schema/preset/SDK.
- [ ] Hoàn thành feed latest rồi tích hợp recommendation thật; chuyển provider mail chỉ khi được duyệt.
- [ ] Chốt contract riêng trước khi bắt đầu comments/reactions/chat.

Phụ thuộc module: Friends → Notifications; Users → Friends; Profile → Friends + Media; Feed → Posts; Auth → Mail.

## Cổng duyệt DB và cấu hình

- Schema TypeScript không chứng minh DB remote đã đồng bộ. Audit DDL/dữ liệu trước khi viết migration.
- Cần duyệt: media upload sessions/avatar reference; unordered pending friend pair; notification target/deduplication; index theo query thật; schema chat nếu triển khai.
- Không thêm ALTER TABLE vào startup; không sửa migration cũ, reset DB hoặc tự chạy migration remote.
- Không cài Cloudinary/Resend hoặc đổi SMTP/auth chỉ vì đọc tài liệu này.
- Secret chỉ nằm trong env BE/hosting, không Markdown hay biến `VITE_`. Không commit `.env` thật.

## Checklist hoàn tất mỗi module

- [ ] Contract, dependency, migration và config chưa rõ đã được chốt.
- [ ] Có logic thật, không thay 501 bằng success giả; giữ nguyên placeholder ngoài scope.
- [ ] Có validation, phân quyền, DTO allowlist, pagination giới hạn và transaction khi cần.
- [ ] Viết lại unit tests nghiệp vụ khi triển khai; các spec skeleton đã được xóa có chủ đích.
- [ ] Chuyển case e2e của route đã hoàn thành từ kỳ vọng 501 sang success/failure thực tế; không xóa coverage để làm xanh.
- [ ] Chạy `npm run build`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand` khi sửa runtime.
- [ ] Lint file TS thay đổi bằng `npx eslint <files>`; tránh script lint --fix toàn repo.
- [ ] Chạy `git diff --check`; báo rõ test chưa chạy và giới hạn tích hợp ngoài.

Unit mock không chứng minh lock/unique constraint/rollback trên DB. Các invariant đồng thời cần integration test trên DB cô lập; provider ngoài chỉ test sandbox được cho phép. Không commit/push nếu chưa được yêu cầu.
