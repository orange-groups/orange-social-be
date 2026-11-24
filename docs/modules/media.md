# Guide triển khai Media — Cloudinary

[Mục lục module](README.md)

## API hiện có — POST /media/avatar

UI gửi ảnh cho backend; backend dùng SDK upload ảnh lên Cloudinary. Không
cần UI xin chữ ký hoặc gọi Cloudinary trực tiếp.

- Gửi Bearer access token và `multipart/form-data` với đúng một trường file tên
  `file`, không cần trường khác. Trên UI dùng `FormData` và để trình duyệt tự
  đặt `Content-Type` cùng multipart boundary.
- Nhận JPEG, PNG hoặc WebP tối đa 2 MiB. Backend kiểm tra chữ ký đầu tệp,
  Cloudinary xử lý nội dung ảnh; không tin MIME do UI khai.
- Trả `201` với `{ "success": true, "data": { "publicId": "...", "secureUrl": "https://..." } }`.
- Trả `400` khi thiếu file hoặc sai cấu trúc multipart, `401` khi không xác
  thực, `413` khi file quá lớn, `415` khi không nhận diện định dạng, `502` khi
  Cloudinary lỗi và `503` nếu thiếu cấu hình backend.

```bash
curl -X POST http://localhost:3000/media/avatar \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@avatar.png"
```

Để upload và đổi avatar trong cùng request, dùng [`POST /profile/me/avatar`](profile.md#cập-nhật-ảnh-đại-diện--post-profilemeavatar).
Xem [cấu hình Cloudinary](../../src/modules/media/README.md). API Media này chỉ
upload, không cập nhật hồ sơ hay tạo `uploadId` cho `/profile/me/avatar/complete`.
Ảnh được lưu trên Cloudinary nhưng chưa có cơ chế quota hay dọn ảnh mồ côi;
cần bổ sung các cơ chế đó trước khi mở rộng sử dụng.

Các phần bên dưới mô tả **phương án upload trực tiếp cũ**, không phải luồng
để tích hợp UI với API trên. Các route khung cũ vẫn trả `501`.

## 1. Module dùng để làm gì?

Media quản lý upload ảnh lên Cloudinary, xác minh ảnh thuộc đúng người
và dọn ảnh không còn sử dụng.

Phạm vi hiện tại chỉ là avatar:

- Cloudinary lưu file và cung cấp URL hiển thị.
- PostgreSQL lưu chủ sở hữu và trạng thái lượt upload.
- Media cấp chữ ký, xác minh và dọn ảnh.
- Profile cập nhật avatar của người dùng.

Phần xin chữ ký, gắn ảnh vào hồ sơ và dọn ảnh của phương án này vẫn là skeleton.

## 2. Trình tự triển khai theo từng API

Luồng chính:
Xin chữ ký → FE upload Cloudinary → Complete avatar.

### API 1 — POST /media/upload-signature

**Mục đích:** tạo lượt upload và chữ ký; chưa cập nhật avatar.

**Input:** Bearer token và body:

```json
{ "purpose": "avatar" }
```

**Output — HTTP `201 Created`:**

```json
{
  "success": true,
  "data": {
    "uploadId": "b93eb757-9f7a-4ded-80bf-28798f9af203",
    "uploadUrl": "https://api.cloudinary.com/v1_1/your_cloud_name/image/upload",
    "apiKey": "<cloudinary-public-api-key>",
    "params": {
      "timestamp": 1794355200,
      "public_id": "orange-social/avatars/<user-id>/<random-uuid>",
      "upload_preset": "orange-preset",
      "overwrite": false
    },
    "signature": "<signature-generated-by-backend>",
    "completeBefore": "2026-11-11T00:15:00.000Z",
    "constraints": {
      "maxBytes": 2097152,
      "formats": ["jpg", "jpeg", "png", "webp"]
    }
  }
}
```

Các giá trị là ví dụ; uploadId, timestamp, chữ ký và thời hạn do BE tạo thực tế.

- [ ] Controller
  - [ ] Lấy user từ JWT, không nhận owner do FE khai.
  - [ ] Validate purpose rồi gọi `createUploadSignature()`.
- [ ] Service/database
  - [ ] Kiểm tra config và quota.
  - [ ] Implement `reserveUpload()`: khóa user, kiểm tra quota,
        tạo pending session trong transaction.
  - [ ] Sinh publicId ngẫu nhiên do BE kiểm soát.
  - [ ] Ký đúng params bằng `signImageUpload()`, dùng overwrite=false.
  - [ ] Trả thông tin upload, không trả API secret.
- [ ] Kiểm thử
  - [ ] Thiếu token, purpose sai, quota vượt, config thiếu.
  - [ ] Params/signature khớp nhau.
  - [ ] Xin chữ ký đồng thời không vượt quota.

### API 2 — POST {uploadUrl} của Cloudinary

**Mục đích:** FE gửi file trực tiếp lên Cloudinary.
Đây không phải route mới của BE.

**Input:** FormData gồm file, api_key, signature và đúng params ở API 1.
**Output:** kết quả upload Cloudinary, không dùng envelope của ứng dụng.
Ví dụ rút gọn các trường liên quan:

```json
{
  "asset_id": "<cloudinary-asset-id>",
  "public_id": "orange-social/avatars/<user-id>/<random-uuid>",
  "resource_type": "image",
  "format": "jpg",
  "bytes": 153600,
  "width": 512,
  "height": 512,
  "secure_url": "https://res.cloudinary.com/your_cloud_name/image/upload/<public-id>.jpg"
}
```

- [ ] FE
  - [ ] Kiểm tra sơ bộ định dạng/dung lượng và tạo preview.
  - [ ] Xin chữ ký, giữ uploadId để complete.
  - [ ] Gửi file cùng params đã ký, không tự sửa params.
  - [ ] Không gửi Bearer token của ứng dụng sang Cloudinary.
  - [ ] Không ép Content-Type làm mất multipart boundary.
  - [ ] Hiển thị loading/lỗi/cancel và giải phóng URL preview.
  - [ ] Upload thành công mới gọi API 3.
- [ ] Kiểm thử
  - [ ] File sai/quá lớn, request lỗi hoặc bị hủy.
  - [ ] Lỗi không làm mất avatar cũ.
  - [ ] Kiểm tra preset/overwrite thực tế bằng sandbox được phép.

Upload xong chưa có nghĩa avatar đã được lưu trong ứng dụng.

### API 3 — POST /profile/me/avatar/complete

**Mục đích:** xác minh ảnh rồi cập nhật avatar.

**Input:** Bearer token và body:

```json
{ "uploadId": "<uuid>" }
```

**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://res.cloudinary.com/your_cloud_name/image/upload/<public-id>.jpg"
  }
}
```

- [ ] Controller
  - [ ] Lấy user từ JWT, validate uploadId UUID.
  - [ ] Gọi `ProfileService.completeAvatarUpload()`.
- [ ] Media service
  - [ ] Kiểm tra upload thuộc user, đúng purpose, chưa hết hạn.
  - [ ] Đọc metadata bằng `getImage(publicId)` đã lưu, có timeout.
  - [ ] Kiểm tra assetId, loại ảnh, format, dung lượng/kích thước
        và HTTPS URL từ provider.
  - [ ] Không tin URL FE tự gửi.
- [ ] Profile/database
  - [ ] Gọi Cloudinary ngoài transaction.
  - [ ] Khi lưu, khóa user rồi upload session và kiểm tra lại trạng thái.
  - [ ] Gọi `attachVerifiedUpload()`, chuyển pending → attached.
  - [ ] Cập nhật avatar URL/reference và đánh dấu ảnh cũ cần cleanup
        trong cùng transaction.
  - [ ] Complete lặp chỉ an toàn khi ảnh vẫn gắn đúng profile;
        không gắn lại ảnh đã thay/xóa.
- [ ] FE và kiểm thử
  - [ ] Chỉ đổi avatar hiển thị sau khi BE lưu thành công.
  - [ ] Test sai owner/purpose, hết hạn, metadata sai và timeout.
  - [ ] Test complete lặp/đồng thời và rollback.
  - [ ] Reload và `/auth/me` trả ảnh mới; lỗi vẫn giữ ảnh cũ.

### API 4 — DELETE /profile/me/avatar

**Mục đích:** gỡ avatar và đánh dấu ảnh cần dọn.

**Input:** Bearer token, không body.
**Output — HTTP `200 OK`:**

```json
{
  "success": true,
  "data": {
    "avatarUrl": null
  }
}
```

- [ ] Controller
  - [ ] Lấy user từ JWT, gọi `ProfileService.removeAvatar()`.
- [ ] Service/database
  - [ ] Khóa user/session theo cùng thứ tự như complete.
  - [ ] Xóa URL/reference và gọi `scheduleCleanup()` trong transaction.
  - [ ] Gọi lại khi avatar đã null vẫn thành công.
  - [ ] Không xóa tài nguyên của người khác hoặc legacy chưa rõ ownership.
- [ ] FE và kiểm thử
  - [ ] Hiển thị avatar mặc định sau thành công.
  - [ ] Test gọi lặp, rollback và delete cạnh tranh complete.
  - [ ] Provider xóa lỗi không đảo ngược hồ sơ đã lưu.

## 3. Cleanup — tác vụ nội bộ

Không mở API cleanup public.

- [ ] `scheduleCleanup()` chỉ ghi trạng thái trong transaction.
- [ ] `cleanupBatch()` lấy batch giới hạn, kiểm tra không còn reference.
- [ ] Đánh dấu deleting trước khi gọi provider ngoài transaction.
- [ ] `destroyImage()` có timeout; ảnh không tồn tại coi là đã xóa.
- [ ] `finishCleanup()` ghi kết quả, có retry/lease khi worker chết.
- [ ] Phối hợp lock/state với complete để không xóa nhầm ảnh đang dùng.
- [ ] Chỉ dọn pending sau cửa sổ hiệu lực chữ ký đã được kiểm chứng.
- [ ] Chốt lệnh nội bộ/lịch chạy; không dùng setInterval làm scheduler
      đáng tin cậy trên Vercel.
- [ ] Test cleanup retry, attach cạnh tranh cleanup và ảnh legacy.

Chữ ký không phải vé một lần và không ký bytes ảnh.
completeBefore chỉ là hạn ứng dụng, không thu hồi chữ ký Cloudinary.
Không mặc định đợi hai giờ là đủ để chống replay.

## 4. Nghiệm thu

- [ ] Chọn ảnh → upload → complete → reload vẫn thấy avatar mới.
- [ ] Thay/xóa avatar đúng; lỗi không làm mất ảnh cũ.
- [ ] Test ownership, quota đồng thời, rollback và cleanup trên DB cô lập.
- [ ] Unit test mock provider; sandbox chỉ chạy khi được phép.
- [ ] Chạy build/unit/e2e/lint và ghi kết quả.
- [ ] Kiểm tra không log secret, chữ ký hoặc thông tin nhạy cảm.
- [ ] Ghi commit, cấu hình/migration cần áp dụng và giới hạn còn lại.

API BE dùng envelope `{ "success": true, "data": ... }`;
controller không tự bọc response lần nữa.
