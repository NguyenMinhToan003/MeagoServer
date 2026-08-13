# Blueprint: Core rút từ EvoAutomationServer

> Kết quả khảo sát source mẫu `EvoAutomationServer` (NestJS 10, TypeORM 0.3, Postgres, Redis, CASL) — cái gì lấy, cái gì lấy-có-sửa, cái gì KHÔNG lấy.

## Lấy gần như nguyên bản (đã đưa vào Meago)
| Nguồn (Evo) | Đích (Meago) | Ghi chú |
|---|---|---|
| `abstracts/models/ABaseModel.abstract.ts` | `src/common/abstracts/base.entity.ts` | uuid PK + `@VersionColumn` (optimistic lock) + timestamps; thêm `TrackingEntity` (createdBy/updatedBy) mà Evo lặp lại thủ công ở từng entity |
| `abstracts/common/AQueries.abstract.ts` | `src/common/dto/base-query.dto.ts` | Evo để tất cả là string rồi cast tay — Meago dùng `@Type(() => Number)` + class-validator |
| `middlewares/errors.middleware.ts` | `src/common/filters/http-exception.filter.ts` | shape lỗi thống nhất `{statusCode, error, message, path, timestamp}` |
| `middlewares/logger.middleware.ts` | `src/common/middlewares/logger.middleware.ts` | log method/url/status/duration |
| `main.ts` (bootstrap template) | `src/main.ts` | helmet, compression, cookie-parser, CORS credentials, versioning URI v1, Swagger, ValidationPipe — thêm `whitelist + forbidNonWhitelisted` (Evo thiếu), port/CORS lấy từ env (Evo hard-code) |
| Cấu trúc module per-feature `X.controller/service/entity/dto/module` | `src/modules/*` | giữ convention đặt file |
| `configs/*.conf.ts` với `registerAs()` | `src/configs/*` | thêm Joi validationSchema (Evo có joi nhưng không dùng) |

## Lấy nhưng viết lại
- **`AActionsModel` (918 dòng) → `BaseService` (~120 dòng)**: giữ lại phần cốt lõi nhất — idiom **threading `EntityManager`**: mọi method nhận `manager?` cuối, `getRepoManager(manager)` trả repo gắn transaction. Bỏ: permission-scope 3 trục (owner/leader/assigns), CDC, Elasticsearch mirror, filter DSL 800 dòng — đó là đồ riêng của Evo.
- **Auth**: Evo dùng access token 15 NGÀY + RSA keypair per-token + tra DB/Redis mỗi request + UPDATE lastActive mỗi request (tốn hot path), **không có refresh token**. Meago thay bằng access JWT 15 phút stateless + refresh rotation (docs/02).
- **RBAC**: Evo dùng CASL + subject class tree + team/department. Meago bỏ CASL, dùng custom PermissionsGuard + permission string (docs/03), không team/phòng ban theo yêu cầu.
- **Transaction decorator `@StartTransaction()`**: ý tưởng giữ, nhưng cách Evo scan `this` tìm DataSource là fragile → Meago inject `DataSource` thẳng vào `BaseService.runInTransaction()`.

## KHÔNG lấy (anti-pattern trong source mẫu)
- `synchronize: true` hard-code kể cả prod → Meago: theo env, prod luôn migration (`src/database/data-source.ts` chuẩn CLI).
- `@Global()` + `forwardRef()` tràn lan (triệu chứng circular dependency) → Meago chỉ Global cho RedisModule/RbacModule (infra cho global guard).
- Script migration tự chế đọc nhầm env MySQL trong khi runtime dùng Postgres.
- Private packages `bodevops-be-common`, `@allinsocial/*` → inline interface tương đương (`IBaseResponse`, `IPaginatedResult`).
- Wrap response thủ công từng controller (`CoreRes.OK`) → global `TransformInterceptor`.
- `RolesGuard` nuốt lỗi (`catch { return false }`) biến bug thành 403 câm.
- Dep rác: `bcrypt`+`bcryptjs`, `slug`+`slugify`, `redis`+`ioredis`, `npm`, `i` trong dependencies.
