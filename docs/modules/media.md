# Media — Cloudinary signed upload

[Mục lục và quy ước chung](README.md)

## Hiện trạng và phạm vi

Trong `src/modules/media/` đã có controller/service, CloudinaryService, MediaCleanupService, MediaUploadRepository và DTO/types. Tất cả xử lý vẫn là placeholder; package `cloudinary` chưa được cài. Chỉ hỗ trợ purpose `avatar`, chưa có cover/post upload.

## Cấu hình Cloudinary trước triển khai

Tạo preset signed, ví dụ `orange-preset`:

- Signing mode **Signed**; Delivery type **Upload**, Access control **Public** phù hợp avatar công khai. Public là quyền xem, không phải quyền upload.
- Trong giao diện preset **Optimize and Deliver → Allowed formats**, nhập `jpg,jpeg,png,webp`; để **Format** trống nếu không muốn ép chuyển định dạng.
- Cấu hình giới hạn dung lượng/pixel nếu console hỗ trợ, rồi xác minh bằng SDK/API và upload thử sandbox. Không coi kiểm tra FE là giới hạn storage.
- BE ký `overwrite: false` và tự chọn publicId; xác minh hành vi preset khi có tham số upload ghi đè.

Các biến **dự kiến**, chưa được service khung sử dụng:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_AVATAR_UPLOAD_PRESET=orange-preset
```

Chỉ lưu secret trên BE. API key/cloud name có thể xuất hiện trong response upload. Việc thêm env chưa làm API chạy; cần duyệt cài SDK, schema và logic. Giới hạn đề xuất: JPEG/PNG/WebP, 2 MB, 5 chữ ký/phút và 30/ngày/user; chốt trước khi áp dụng.

## API và luồng

`POST /media/upload-signature` (Bearer) nhận `{ "purpose": "avatar" }`, trả 201 với UploadSignatureResponseDto:

- uploadId, uploadUrl, apiKey, signature, completeBefore;
- params: timestamp, public_id, upload_preset, overwrite=false;
- constraints: maxBytes, formats.

1. BE reserve pending session và quota atomically; tự sinh publicId ngẫu nhiên gắn owner/purpose.
2. CloudinaryService.signImageUpload ký đúng bộ params bằng API secret.
3. FE upload trực tiếp tới uploadUrl bằng file, api_key, signature và đúng params đã ký. Không gửi app Bearer token sang Cloudinary.
4. FE gọi `POST /profile/me/avatar/complete` bằng uploadId, **không gửi URL tùy ý để BE lưu**.
5. BE lấy metadata server-side và xác minh trước khi Profile attach.

## Schema cần duyệt

Hiện chưa có `media_uploads` hoặc `users.avatar_upload_id`. Đề xuất migration lưu MediaUploadSession: owner, purpose, publicId unique, assetId, resourceType, status, secureUrl, timestamp/hạn, attachedAt và lỗi cleanup gọn. Giữ avatarUrl cũ để tương thích auth; không xóa tài nguyên legacy chưa xác định ownership.

## Trình tự triển khai

1. Wire Config/Database/SDK sau duyệt, validate cấu hình; thiếu cấu hình trả lỗi khả dụng, không ký giả.
2. Implement `reserveUpload`: khóa user, kiểm tra quota, tạo pending session trong transaction; không dùng counter RAM nhiều instance.
3. Implement `signImageUpload`, `getImage`, `destroyImage` với timeout và mapping lỗi không lộ secret.
4. `verifyProfileUpload`: kiểm tra owner/purpose/hạn/trạng thái; lookup publicId đã lưu, kiểm tra assetId, image, format, bytes, dimensions và HTTPS URL từ provider.
5. `attachVerifiedUpload(tx, ...)`: lock/recheck session trong transaction caller; pending → attached. Complete lặp chỉ idempotent khi vẫn gắn đúng profile; không hồi sinh ảnh đã thay/xóa.
6. `scheduleCleanup(tx, uploadId)`: chỉ ghi trạng thái, không gọi network trong DB transaction.
7. `cleanupBatch` claim batch có giới hạn, recheck không còn reference, đánh dấu deleting, gọi provider ngoài transaction rồi ghi outcome; cần lease/retry khi worker chết.

Chữ ký không phải vé một lần và không ký bytes của ảnh. `completeBefore` chỉ là hạn ứng dụng, không thu hồi chữ ký tại Cloudinary. Chốt cửa sổ hiệu lực provider và buffer trước khi dọn pending uploads; không mặc định một mốc hai giờ là đủ. Phối hợp attach/cleanup bằng cùng lock/state để không gắn ảnh đang xóa.

Không thêm cleanup route public hoặc setInterval làm scheduler production. Cơ chế chạy lệnh nội bộ/cron cần duyệt riêng.

## Kiểm thử nghiệm thu

- Sign đúng params; thiếu config, quota đồng thời, format/bytes/purpose sai và timeout metadata.
- Upload người khác, URL giả, replay, complete hết hạn/lặp và thay avatar đồng thời.
- DB integration cho reserve quota và attach-vs-cleanup; rollback không đổi reference.
- Cleanup lỗi có thể retry, không xóa ảnh còn dùng/legacy; sandbox kiểm tra preset và overwrite thực tế.
