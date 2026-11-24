# Media / Cloudinary — cấu hình và hướng dẫn triển khai

## 1. Trạng thái

- Đã cài package `cloudinary` (SDK v2).
- `POST /media/avatar` nhận `multipart/form-data` và backend upload lên
  Cloudinary bằng SDK. Xem [hợp đồng API](../../../docs/modules/media.md).
- Ba biến cấu hình đầu ở mục dưới là bắt buộc cho API này. SDK chỉ được cấu
  hình khi upload; nếu thiếu biến, API trả `503` mà không cản app khởi động.
- Upload chưa cập nhật hồ sơ. Ký upload trực tiếp, xác nhận/xóa avatar và
  cleanup vẫn là placeholder.
- Không sửa file env thật hoặc cấu hình tài khoản Cloudinary chỉ vì đọc hướng dẫn này.

## 2. Biến môi trường

Khai báo trên **backend**, không dùng biến `VITE_`, không đưa secret vào FE:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_AVATAR_UPLOAD_PRESET=avatar_signed
```

| Biến | Lấy ở đâu / vai trò |
| --- | --- |
| CLOUDINARY_CLOUD_NAME | Product environment đang dùng trong Cloudinary Console |
| CLOUDINARY_API_KEY | API key của đúng product environment, trong phần API Keys |
| CLOUDINARY_API_SECRET | Secret tương ứng key; chỉ lưu backend/secret manager |
| CLOUDINARY_AVATAR_UPLOAD_PRESET | Tên preset upload đã tạo ở cùng environment, không phải preset ID tự suy đoán |

Ba biến đầu dùng cấu hình SDK. `CLOUDINARY_AVATAR_UPLOAD_PRESET` không cần cho
`POST /media/avatar`; các mục dưới về preset mô tả phương án upload trực tiếp cũ.

ConfigModule hiện đọc theo ưu tiên:

1. Biến môi trường process/hosting.
2. `.env.${NODE_ENV}`, mặc định `.env.development` nếu process chưa có NODE_ENV.
3. `.env` làm fallback.

Đặt `NODE_ENV=production` trước khi khởi động để chọn `.env.production`. File production thiếu một biến có thể vẫn nhận giá trị từ `.env`; khi deploy nên khai báo đủ trên hosting để tránh dùng nhầm tài khoản local. Không commit các file env thật; `.env.example` chỉ chứa tên biến rỗng.

## 3. Cấu hình signed preset trên Cloudinary

Trong Console của đúng product environment, mở Settings → Upload / Upload presets (tên menu có thể thay đổi):

1. Tạo preset tên khớp CLOUDINARY_AVATAR_UPLOAD_PRESET.
2. Chọn signing mode **Signed**, không Unsigned.
3. Giới hạn định dạng `jpg,jpeg,png,webp`; không SVG/video cho avatar.
4. Đặt max file size **2.097.152 byte (2 MiB)** nếu tùy chọn có trong UI; nếu UI không có, cấu hình bằng API preset theo khả năng của tài khoản và kiểm tra lại bằng API.
5. Đặt overwrite false; backend cũng phải ký `overwrite: false` khi cấp lượt upload.
6. Giới hạn pixel đầu vào nếu provider/preset hỗ trợ; giới hạn đề xuất cần nhóm chốt. Resize đầu ra không mặc nhiên là giới hạn pixel đầu vào.
7. Kiểm tra bằng metadata preset và file thử: file đúng được nhận, file sai định dạng/quá dung lượng bị từ chối. Không coi FE validation là bảo vệ tài khoản.

Chữ ký không ký nội dung file và không là vé dùng một lần. Phải kiểm tra ràng buộc nào được Cloudinary thực thi thực tế, đặc biệt khi tham số request có thể tương tác/ghi đè preset. Sau upload, BE vẫn xác minh metadata trước khi gắn ảnh.

## 4. Cấu hình SDK trong CloudinaryService khi được giao viết logic

Đoạn dưới là **ví dụ**, chưa được nối vào service:

```ts
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

// config là ConfigService được Nest inject, không đọc env tùy tiện tại import time.
cloudinary.config({
  cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
  api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
  api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
  secure: true,
});
```

ConfigModule đã global; không cần tạo thêm kết nối hay đưa cấu hình Cloudinary vào AuthService. SDK config trên là state dùng chung trong process: cấu hình một lần cho cùng environment, không đổi credentials theo request/user.

**Chọn thời điểm validate trước khi triển khai:** ví dụ `getOrThrow` cho thấy cấu hình bắt buộc, nhưng gọi trong constructor sẽ khiến cả app không start khi thiếu env. Đề xuất kiểm tra khi media được dùng, trả 503 nếu thiếu, để auth hiện có không bị ảnh hưởng; nếu muốn fail-fast toàn app phải thống nhất riêng.

Không chỉ cài SDK rồi xóa placeholder: còn cần quota, upload session, ownership và schema được duyệt.

## 5. Trách nhiệm từng hàm

| Hàm | SDK/công việc khi triển khai |
| --- | --- |
| signImageUpload(params) | `cloudinary.utils.api_sign_request(params, apiSecret)`; chỉ nhận bộ params do server dựng |
| getImage(publicId) | `cloudinary.api.resource(publicId, { resource_type: 'image', type: 'upload' })`; narrow metadata về VerifiedImage, không trả raw provider response |
| destroyImage(publicId) | `cloudinary.uploader.destroy` với resource_type image và delivery type phù hợp; missing là đã xóa; chỉ gọi cho tài nguyên đã kiểm tra ownership/reference |

- Dùng timeout theo API/SDK thực tế; không đặt tùy chọn chưa kiểm chứng.
- Không log secret, token hoặc chữ ký; không serialize nguyên provider error ra client.
- MediaService kiểm tra chủ upload, purpose, thời hạn và quota; CloudinaryService chỉ là adapter nhà cung cấp.
- Không gọi Cloudinary khi DB transaction đang giữ lock. Metadata lookup ở ngoài transaction, sau đó recheck session khi attach.

## 6. Luồng FE ↔ BE ↔ Cloudinary

1. FE gọi POST /media/upload-signature với `{ "purpose": "avatar" }` và Bearer token app.
2. BE tạo pending upload session gắn user, tự chọn publicId/preset/timestamp/overwrite; trả upload URL, apiKey công khai, params, signature, uploadId và hạn complete.
3. FE gửi FormData trực tiếp tới Cloudinary: file, api_key, signature và đúng các key trong params. Không gửi Bearer token app sang Cloudinary.
4. FE gọi POST /profile/me/avatar/complete với uploadId, không gửi URL tùy ý để BE lưu.
5. BE tra cứu metadata theo publicId đã lưu, kiểm tra ownership, format, bytes, resource type; attach atomically, cập nhật profile rồi mới schedule cleanup ảnh cũ.

Hiện các bước BE trên chưa có logic. `completeBefore` của app không tự thu hồi chữ ký tại Cloudinary; cleanup phải tính cửa sổ replay thực tế và tránh xóa tài nguyên đang dùng.

## 7. Kiểm tra cấu hình an toàn

- Ping tài khoản bằng API server-side: thành công chứng minh credentials/environment dùng được, không chứng minh upload có quyền hoặc preset đủ giới hạn.
- Đọc preset bằng API: kiểm tra signed mode, formats, size và overwrite; không in secret/raw response nhạy cảm.
- Chỉ upload/xóa ảnh sandbox khi người dùng cho phép test tích hợp. Không tự sửa preset hoặc xóa tài nguyên tài khoản thật.
- Unit test mock SDK, không đọc secret thật, không gọi mạng.
- Khi triển khai logic mới phải thêm tests thiếu env/SDK lỗi/timeout/metadata sai và giữ auth tests đạt.
