# Dev note — Orange Social

## UC-PROFILE-01 — Cập nhật ảnh đại diện

**Tác nhân:** Người dùng đã đăng nhập.

**Mục tiêu:** Thay ảnh đại diện của chính mình và vẫn thấy ảnh mới sau khi tải lại trang.

**Tiền điều kiện:** Có phiên đăng nhập hợp lệ; backend kết nối được PostgreSQL và đã cấu hình Cloudinary.

### Luồng chính

1. Người dùng mở `/profile`, bấm **Đổi ảnh đại diện** và chọn một ảnh JPEG, PNG hoặc WebP tối đa 2 MiB.
2. Frontend kiểm tra sơ bộ, hiện trạng thái đang tải và gửi `POST /profile/me/avatar` với Bearer token và `multipart/form-data` (trường `file`).
3. Backend xác thực token, lấy ID người dùng từ JWT, kiểm tra kích thước và chữ ký đầu tệp. Không nhận ID người dùng hoặc URL ảnh tự khai từ frontend.
4. `MediaService` upload ảnh lên Cloudinary bằng `publicId` do backend tạo. `ProfileService` lưu URL HTTPS trả về vào `users.avatar_url` của đúng người dùng chưa bị xóa.
5. Backend trả `200` với `{ "success": true, "data": { "avatarUrl": "https://..." } }`. Frontend cập nhật ảnh trong phiên đang mở. Khi tải lại, `/auth/refresh` trả ảnh đã lưu trong DB.

### Luồng thay thế và lỗi

| Tình huống | Kết quả |
| --- | --- |
| Hủy chọn ảnh | Không gửi request, giữ nguyên ảnh. |
| Thiếu file, sai định dạng hoặc quá 2 MiB | Báo lỗi; backend không upload hoặc ghi DB. |
| Không có phiên hợp lệ | Backend trả `401`, không upload. |
| Cloudinary lỗi | Không ghi DB, UI báo lỗi và giữ ảnh cũ. |
| Upload thành công nhưng DB không lưu được | API không báo thành công, UI giữ ảnh cũ; ảnh đã upload có thể còn trên Cloudinary. |

### Quyết định kỹ thuật và phạm vi

- Cloudinary giữ file ảnh; PostgreSQL chỉ lưu URL trong bảng `users`. Dùng cột hiện có, không cần migration hay bảng `media_uploads`.
- Dùng một request từ UI tới backend. Không chuyển Cloudinary API secret cho frontend, không dùng luồng xin chữ ký/complete riêng.
- `POST /media/avatar` vẫn chỉ upload, không đổi hồ sơ. Chưa tự động xóa ảnh cũ hay ảnh mồ côi; chưa triển khai quota hoặc xóa avatar.
- Xem [hợp đồng API Profile](modules/profile.md#cập-nhật-ảnh-đại-diện--post-profilemeavatar).
- Ảnh bìa dùng cùng luồng upload qua backend, nhưng lưu vào `users.cover_url` và đọc lại qua `GET /profile/me`. Xem [API cập nhật ảnh bìa](modules/profile.md#cập-nhật-ảnh-bìa--post-profilemecover).

### Kiểm thử

- Backend: build, lint các file liên quan, 52 unit test và 78 e2e test đạt. Các test mới kiểm tra phân quyền, URL do provider trả về, Cloudinary lỗi và DB ghi lỗi.
- PostgreSQL cục bộ cô lập: đăng nhập thật, cập nhật ảnh, kiểm tra người dùng khác không bị đổi, `/auth/me` và `/auth/refresh` đều trả URL đã lưu. Cloudinary được mock trong lần chạy này.
- Frontend: build, lint và kiểm tra bản dịch đạt. Playwright với API giả lập kiểm tra tệp sai, multipart/Bearer token, trạng thái đang tải, thành công, giữ ảnh khi lỗi và tải lại trang.
- Chưa chạy một kịch bản duy nhất kết hợp browser, PostgreSQL và Cloudinary thật. Endpoint upload riêng `POST /media/avatar` đã được kiểm tra trên Cloudinary sandbox trước đó.

## UC-PROFILE-02 — Xem và cập nhật thông tin cá nhân

**Tác nhân:** Người dùng đã đăng nhập.

**Mục tiêu:** Sửa họ tên, giới thiệu hoặc ngày sinh; khi mở lại `/profile` sẽ thấy thông tin đã lưu.

1. `GET /profile/me` đọc hồ sơ của user trong JWT, trả ngày sinh `YYYY-MM-DD` và số bạn bè thực, không trả email, thông tin xác thực hay mật khẩu.
2. `PATCH /profile/me` nhận một hoặc nhiều trường `fullName`, `bio`, `dateOfBirth`. Trường thiếu được giữ nguyên; `null` xóa giới thiệu hoặc ngày sinh. Từ chối tên trắng, ngày sai hoặc ở tương lai, trường ngoài danh sách và request rỗng.
3. Backend cập nhật bảng `users` hiện có. Chỉ user chưa bị xóa thuộc phiên hiện tại được cập nhật. Không cần migration.
4. Frontend gọi `GET /profile/me` để hiển thị tên, username, ngày sinh và giới thiệu; email lấy từ phiên đăng nhập. Bấm **Sửa thông tin cá nhân** để chỉnh họ tên, giới thiệu và ngày sinh. Form gửi `PATCH` chỉ với các trường thay đổi, hiển thị dữ liệu server trả về nếu lưu thành công và giữ bản nháp nếu lưu lỗi.

Xem [hợp đồng API Profile](modules/profile.md). Đổi email, mật khẩu và hồ sơ công khai không thuộc use case này.

**Kiểm thử:** Đã xác nhận `GET`/`PATCH` trên PostgreSQL cục bộ cô lập: dữ liệu được lưu, tài khoản khác không đổi và số bạn bè không tính tài khoản đã xóa. Playwright với API giả lập kiểm tra tải dữ liệu, mở/hủy chỉnh sửa, giữ bản nháp khi lỗi và gửi lại thành công.

## UC-AUTH-01 — Đổi mật khẩu khi đang đăng nhập

Tại `/profile`, người dùng nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới. Frontend chỉ gửi `{ currentPassword, newPassword }` bằng `POST /auth/change-password` với Bearer access token. Đăng ký, đặt lại và đổi mật khẩu dùng chung quy tắc: 8–128 ký tự, có chữ cái, chữ số và ký tự đặc biệt, không bắt buộc cả chữ hoa lẫn chữ thường. Khi đổi, mật khẩu mới phải khác mật khẩu hiện tại.

Backend xác minh được hash bcrypt cũ và scrypt mới, sau đó lưu hash scrypt, tăng `token_version` và đặt `refresh_token_hash` thành `null` trong cùng một lệnh cập nhật. Nếu mật khẩu đã bị đổi bởi request khác, lệnh không ghi đè và API trả `409`. Scrypt không cắt mật khẩu ở 72 byte.

- `200`: trả `{ "success": true, "data": { "message": "Đã đổi mật khẩu. Vui lòng đăng nhập lại." } }`, xóa refresh cookie và vô hiệu hóa các phiên cũ. Frontend xóa phiên trong bộ nhớ, chuyển về đăng nhập và thông báo thành công.
- `400`: input không hợp lệ hoặc dùng lại mật khẩu hiện tại. `401`: thiếu hoặc hết hạn phiên. `403`: mật khẩu hiện tại không đúng.
- Không cần migration. Đây là luồng riêng với **Quên mật khẩu** qua email.

**Kiểm thử:** E2e kiểm tra xác thực, validation, mật khẩu hiện tại sai, vô hiệu hóa access/refresh token cũ và đăng nhập với mật khẩu mới. Trên PostgreSQL cô lập, hai request đổi đồng thời chỉ có một request thành công. Playwright với API giả lập kiểm tra xác nhận mật khẩu, báo lỗi và về `/login` khi thành công.

## UC-AUTH-02 — Gửi email khôi phục qua Resend

`POST /auth/forgot-password` vẫn dùng cùng body và phản hồi. Auth tạo token
một lần, lưu hash trong Redis trong 15 phút rồi gọi MailService gửi link qua
Resend. Nếu Resend không chấp nhận, backend thu hồi token và giữ thông báo
chung để không tiết lộ tài khoản nào tồn tại. Không đổi phiên, Redis, DB hay FE.

Backend cần `RESEND_API_KEY` và `MAIL_FROM`. Đã kiểm tra sender test với địa
chỉ giả lập của Resend. Sau đó dùng sender trên domain đã xác minh để gửi
thử đến Gmail; Resend chấp nhận request (`HTTP 200`). Backend local đã dùng
sender trên domain này; cấu hình production không thay đổi.

## UC-FRIENDS-01 — Gửi và thu hồi lời mời kết bạn

**Tác nhân:** Người dùng đã đăng nhập, đang xem hồ sơ của một người dùng khác.

1. Trang `/profile/:userId` hiển thị quan hệ từ backend. Nếu chưa kết bạn và
   không có lời mời đang chờ, người dùng bấm **Kết bạn**.
2. Frontend gửi `POST /friends/requests` với `{ receiverId }`. Backend lấy
   người gửi từ JWT, khóa hai user theo thứ tự UUID, xác minh cả hai còn hoạt
   động và chưa có quan hệ bạn bè hay lời mời đang chờ ở bất kỳ chiều nào.
3. Backend lưu request `pending`, trả `201`. Hồ sơ hiện **Đã gửi lời mời** với
   nút **Huỷ lời mời**; phía người nhận đọc được trạng thái lời mời đến khi
   xem hồ sơ người gửi.
4. Khi người gửi bấm **Huỷ lời mời**, frontend gọi
   `DELETE /friends/requests/:requestId`. Backend chỉ chuyển request từ
   `pending` sang `cancelled` nếu đúng người gửi, rồi trả `200`. Nút
   **Kết bạn** hiện lại và có thể gửi lời mời mới.

**Luồng lỗi:** Tự gửi trả `400`; người nhận không tồn tại/đã xóa trả `404`;
gửi trùng, gửi chéo hoặc đã là bạn trả `409`. Thu hồi lời mời không thuộc
mình trả `404`, thu hồi lại lời mời đã kết thúc trả `409`. Khi trạng thái
đã đổi, frontend tải lại hồ sơ. Lỗi mạng giữ trạng thái hiện tại và cho thử lại.

**Dữ liệu và phạm vi:** Dùng bảng `friend_requests` hiện có, không cần
migration. Thu hồi giữ record lịch sử. Danh sách thật được bổ sung trong
UC-FRIENDS-02 và chấp nhận trong UC-FRIENDS-03; từ chối chưa triển khai.

**Kiểm thử:** PostgreSQL cục bộ cô lập xác nhận chỉ một lời mời được tạo
khi gửi trùng/gửi chéo đồng thời, chỉ người gửi được thu hồi và có thể gửi
lại sau đó. Playwright với API giả lập kiểm tra gửi, tải lại hồ sơ,
thu hồi và đồng bộ lại quan hệ khi gặp `409`.

## UC-USERS-01 — Tìm người theo họ tên hoặc username

Người đã đăng nhập nhập từ khóa trên thanh tìm kiếm và bấm Enter. Frontend
đi tới `/search?q=...`, gọi `GET /users`, rồi hiển thị họ tên, username,
avatar và quan hệ. Bấm kết quả để mở hồ sơ và dùng nút kết bạn nếu có.

Backend tìm chuỗi con, không phân biệt hoa thường nhưng có phân biệt dấu;
chưa có gợi ý, fuzzy matching hay xếp hạng. Truy vấn không tìm email, loại
bản thân và tài khoản đã xóa. Kết quả phân trang bằng cursor; không cần
migration. Xem [hợp đồng Users](modules/users.md).

**Kiểm thử:** PostgreSQL cô lập xác nhận tìm họ tên tiếng Việt và username,
phân trang, ký tự `%` được tìm theo nghĩa đen và không trả tài khoản đã xóa.
Playwright với API giả lập kiểm tra thanh tìm kiếm, tải thêm và mở hồ sơ.

## UC-FRIENDS-02 — Xem danh sách bạn bè và lời mời

Người đã đăng nhập vào `/friends`. Frontend gọi `GET /friends` và
`GET /friends/requests?direction=incoming` / `direction=outgoing`, thay toàn
bộ người mẫu bằng dữ liệu PostgreSQL. Mỗi mục tải độc lập, có trạng thái
rỗng/lỗi và nút tải thêm. Bấm vào một người để mở hồ sơ; có thể thu hồi lời
mời trực tiếp từ mục đã gửi.

Backend giới hạn theo người dùng trong JWT, chỉ trả lời mời `pending`,
loại tài khoản đã xóa và không trả email. Cursor cố định theo danh sách,
người xem và vị trí sắp xếp. Không cần migration. Chấp nhận được bổ sung
trong UC-FRIENDS-03. Từ chối, huỷ kết bạn và gợi ý chưa triển khai.
Xem [API Friends](modules/friends.md).

**Kiểm thử:** PostgreSQL cục bộ xác nhận ba danh sách không lộ dữ liệu
người khác, không sót mục khi phân trang qua timestamp trùng và không trả
lời mời đã thu hồi. Playwright với API giả lập kiểm tra thử lại, tải thêm
và thu hồi lời mời trên trang Bạn bè.

## UC-FRIENDS-03 — Chấp nhận lời mời kết bạn

Người nhận bấm **Chấp nhận** ở mục **Lời mời nhận được** hoặc trên hồ sơ
người gửi. Frontend gọi `POST /friends/requests/:requestId/accept`.
Backend xác thực người nhận, đổi lời mời từ `pending` sang `accepted`,
lưu quan hệ bạn bè hai chiều và tạo một thông báo cho người gửi trong
cùng transaction. Khi thành công, lời mời rời danh sách chờ và người gửi
xuất hiện trong danh sách bạn bè; hồ sơ chuyển sang **Đã kết bạn**.

Người gửi hoặc người thứ ba không được chấp nhận thay. Lời mời đã thu hồi
không thể chấp nhận. Gửi lại thao tác khi đã là bạn không tạo quan hệ hay
thông báo trùng. Không cần migration.

**Kiểm thử:** PostgreSQL cục bộ kiểm tra chấp nhận đồng thời, tranh chấp với
thu hồi và hoàn tác khi ghi thông báo lỗi. Playwright kiểm tra nút ở cả hai
giao diện và xác nhận người gửi không thấy nút **Chấp nhận**.
