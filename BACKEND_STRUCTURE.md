# Backend structure — Facebook-like Social Network

**Stack:** NestJS · TypeScript · REST API · Socket.IO · PostgreSQL (đề xuất) · Prisma ORM (lựa chọn mặc định, có thể thay bằng ORM khác).

**Mục tiêu:** code theo module nghiệp vụ, dễ chia việc nhóm, dễ kiểm thử, tái sử dụng và mở rộng. File này mô tả **cấu trúc mục tiêu**; các file DTO/guard/repository chỉ tạo khi cần, không phải tất cả đều có ngay sau khi scaffold.

## 1. Cây thư mục

```text
social-network-api/
├── AGENTS.md                       # Hướng dẫn bắt buộc cho coding agents
├── BACKEND_STRUCTURE.md           # Cây thư mục và lệnh tạo code
├── scaffold-backend.sh             # CLI scaffold chạy trong project NestJS
├── .env.example                    # Mẫu biến môi trường (không chứa secret thật)
├── package.json
├── nest-cli.json
├── tsconfig.json
├── prisma/                         # Nếu chọn Prisma
│   ├── schema.prisma               # Model, quan hệ dữ liệu
│   └── migrations/                 # Lịch sử migration
├── prisma.config.ts                # Nếu Prisma phiên bản yêu cầu
├── src/
│   ├── main.ts                     # Bootstrap app, CORS, validation, Swagger
│   ├── app.module.ts               # Root module, lắp ghép feature modules
│   ├── config/                     # Cấu hình ứng dụng, validate .env
│   ├── common/                     # Dùng chung, KHÔNG chứa nghiệp vụ riêng
│   │   ├── decorators/             # @CurrentUser(), ...
│   │   ├── dto/                    # DTO dùng chung: pagination, ...
│   │   ├── filters/                # Global exception filters
│   │   ├── guards/                 # Auth/authorization guard dùng chung
│   │   ├── interceptors/           # Logging, serialization (khi cần)
│   │   ├── pipes/                  # Custom validation / transform
│   │   ├── types/                  # Kiểu dữ liệu dùng chung
│   │   └── utils/                  # Pure utility functions
│   ├── database/
│   │   ├── database.module.ts      # Cấu hình Database providers
│   │   └── prisma.service.ts      # Prisma client adapter/provider (nếu dùng)
│   ├── generated/                  # Prisma generated client (sau generate)
│   └── modules/
│       ├── auth/                   # Đăng ký, đăng nhập, refresh, logout
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── dto/
│       │   ├── guards/
│       │   └── strategies/
│       ├── users/                  # Thông tin tài khoản, tra cứu user
│       ├── profile/                # Hồ sơ, avatar, giới thiệu
│       ├── feed/                   # Timeline và chiến lược phân trang
│       ├── posts/                  # Tạo, sửa, xóa, quyền xem bài viết
│       │   ├── posts.module.ts
│       │   ├── posts.controller.ts
│       │   ├── posts.service.ts
│       │   ├── dto/
│       │   └── repositories/
│       ├── comments/               # Bình luận, trả lời bình luận
│       ├── reactions/              # Like/Love/Haha...; chống trùng
│       ├── friends/                # Lời mời kết bạn, quan hệ bạn bè
│       ├── chat/                   # Cuộc trò chuyện và message realtime
│       │   ├── chat.module.ts
│       │   ├── chat.controller.ts
│       │   ├── chat.service.ts
│       │   ├── chat.gateway.ts
│       │   ├── dto/
│       │   └── events/
│       ├── notifications/          # Lưu thông báo, trạng thái đã đọc
│       │   ├── notifications.module.ts
│       │   ├── notifications.controller.ts
│       │   ├── notifications.service.ts
│       │   ├── notifications.gateway.ts
│       │   ├── dto/
│       │   └── events/
│       └── media/                  # Upload, validate file, lưu metadata
├── test/                           # E2E tests của NestJS
└── docs/                           # OpenAPI, conventions, decisions
```

**Trong mỗi module thông thường:**

```text
modules/comments/
├── comments.module.ts              # Khai báo providers/controllers/imports/exports
├── comments.controller.ts          # HTTP endpoints, DTO validation, auth guard
├── comments.service.ts             # Nghiệp vụ và authorization
├── dto/                            # create-comment.dto.ts, update-comment.dto.ts
└── *.spec.ts                       # Tests bên cạnh file nguồn
```

> Nest CLI còn sinh `app.controller.ts`, `app.service.ts` và các file test mẫu. Có thể giữ lại để làm healthcheck hoặc gỡ bỏ một cách nhất quán sau khi cấu hình ứng dụng; không xóa tùy tiện nếu đang được import.

## 2. Phân chia trách nhiệm

| Thư mục                 | Vai trò / ranh giới                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `config/`               | Nạp và kiểm tra biến môi trường, cấu hình runtime.                              |
| `common/`               | Thành phần kỹ thuật dùng chung nhiều module; tránh chứa logic của Posts/Chat.   |
| `database/`             | Đăng ký kết nối, provider/adapter DB. Không đặt HTTP controller tại đây.      |
| `modules/*`             | Nghiệp vụ độc lập, mỗi module là một ranh giới sở hữu code.                   |
| `dto/`                  | Request validation và kiểu dữ liệu đầu vào/đầu ra của API.                     |
| `controller`            | Nhận request, guard, gọi service; không truy vấn DB trực tiếp.                     |
| `service`               | Nghiệp vụ, phân quyền trên tài nguyên, transaction và điều phối.              |
| `repository/`           | Truy vấn dữ liệu phức tạp cần tách; không bắt buộc cho CRUD đơn giản.       |
| `gateway`               | Xác thực socket, subscribe event, rooms, emit; gọi service cho nghiệp vụ.           |
| `prisma/`               | Schema và migration dữ liệu; không thay đổi schema mà thiếu migration phù hợp. |
| `test/` / `*.spec.ts` | Integration/e2e và unit tests.                                                          |

## 3. Lệnh CLI khởi tạo project

Yêu cầu **Node.js LTS tương thích Nest CLI** và npm. Tham khảo [NestJS CLI](https://docs.nestjs.com/cli/overview) để kiểm tra phiên bản Node cần thiết.

```bash
# Chạy từ thư mục CHA của project, chỉ cần 1 lần
npx @nestjs/cli new social-network-api --package-manager npm
cd social-network-api
```

### 3.1. Cài các thư viện nền tảng

```bash
# Cấu hình, validation, Swagger, realtime, security
npm install @nestjs/config class-validator class-transformer \
  @nestjs/swagger @nestjs/websockets @nestjs/platform-socket.io \
  helmet @nestjs/throttler

# PostgreSQL + Prisma (lựa chọn mặc định)
npm install @prisma/client @prisma/adapter-pg pg
npm install -D prisma @types/pg
```

> Đối với Prisma đời mới, cần cấu hình Prisma Client **theo tài liệu đúng phiên bản** (driver adapter, đường dẫn client generated, schema, `prisma.config.ts`). Lệnh scaffold bên dưới chỉ tạo `PrismaService` dạng Nest provider **chưa kết nối database**. Không coi là một API đã chạy đầy đủ.

### 3.2. CLI tạo toàn bộ Nest modules, controllers, services, gateways

**Cách khuyến nghị:** copy `scaffold-backend.sh` vào thư mục gốc project rồi chạy:

```bash
chmod +x scaffold-backend.sh
./scaffold-backend.sh
```

Script tự tạo 11 business modules, `database.module.ts`, `prisma.service.ts`, `chat.gateway.ts`, `notifications.gateway.ts` và các thư mục dùng chung. Nó dùng Nest CLI để tự thêm import modules/providers đúng quy tắc.

**Hoặc** dùng trực tiếp Nest CLI (ví dụ module Posts):

```bash
npx nest g module modules/posts
npx nest g controller modules/posts
npx nest g service modules/posts
mkdir -p src/modules/posts/{dto,repositories}

# Gateway riêng cho chat:
npx nest g gateway modules/chat
```

**Quan trọng:** Đừng chạy tạo lại khi module/controller/service đã có dữ liệu thực. Script bỏ qua các file chính đã tồn tại nhưng có thể vẫn tác động đến imports khi mới chạy. Nên tạo branch riêng trước khi scaffold. Các `*.spec.ts` mặc định do Nest CLI sinh ra là test skeleton, cần viết test thật.

### 3.3. Thiết lập Prisma (khi đã chốt dùng Prisma)

```bash
npx prisma init --datasource-provider postgresql --output ../src/generated/prisma
# Điền DATABASE_URL vào .env cục bộ, chỉnh schema.prisma và prisma.config.ts
# Sau khi định nghĩa model và cấu hình Prisma Client đúng phiên bản:
npx prisma migrate dev --name init
npx prisma generate
```

**Không chạy migration trước khi cấu hình schema, adapter và database.** Không commit `.env`, credentials hoặc client generated nếu repo quyết định ignore generated code.

### 3.4. Mẫu `.env.example`

```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_ACCESS_SECRET=replace_with_strong_secret
JWT_REFRESH_SECRET=replace_with_another_strong_secret
```

Chỉ là biến mẫu; nếu dùng cookie-based auth thì còn phải thiết kế `cookie`, CORS và CSRF phù hợp. Không copy giá trị ví dụ vào production.

### 3.5. Chạy và kiểm tra

```bash
npm run start:dev
npm run build
npm run lint
npm test
```

Dùng các script thực tế có trong `package.json`; một số template Nest mới sử dụng Vitest hoặc bộ lint mới thay vì Jest/ESLint.

## 4. Nguyên tắc kết nối với frontend React + Vite

- API thống nhất prefix (ví dụ `/api/v1`), phương thức HTTP, error codes, DTO và enum.
- Xuất Swagger/OpenAPI để frontend không tự đoán response.
- HTTP: `auth`, `feed`, `posts`, `comments`, `reactions`, `friends`, `profile`, `notifications`.
- Socket.IO: `chat`, `notifications` realtime; thống nhất event names, room IDs và payload.
- Feed sử dụng **cursor pagination** khi phù hợp, có giới hạn `limit` và thứ tự ổn định.
- Cả HTTP và Socket đều xác thực, phân quyền tại server; không tin `userId` do client khai báo.
- Media dùng storage (local khi dev, object storage khi production); DB lưu metadata, không nhét file lớn trực tiếp vào JSON.
- Sử dụng UTC/ISO-8601 cho timestamp từ server; backend xác định quyền xem/sửa/xóa tài nguyên.

## 5. Khuyến nghị làm nhóm

1. Chốt data model và OpenAPI trước khi chia feature để hạn chế lệch DTO.
2. Mỗi thành viên sở hữu một hoặc vài `src/modules/<feature>`; sửa `app.module.ts`, `common/`, `database/`, Prisma schema cần review.
3. Không tự tạo helpers hoặc guards trùng với `common/`.
4. Mọi PR chạy build/test, có mô tả migration, API change và thay đổi Socket events.
5. Các việc tạo module ở trên **chỉ tạo bộ khung**, không tự triển khai bảo mật, database, JWT hoặc endpoint nghiệp vụ.

## Tham khảo chính thức

- [NestJS — CLI](https://docs.nestjs.com/cli/usages)
- [NestJS — First steps](https://docs.nestjs.com/first-steps)
- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS — WebSocket Gateways](https://docs.nestjs.com/websockets/gateways)
- [Prisma — NestJS](https://www.prisma.io/docs/guides/frameworks/nestjs)
