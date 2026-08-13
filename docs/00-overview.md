# Meago Server — Nền móng (Foundation)

Meago: nền tảng đăng tải, chia sẻ **audio / truyện**. Repo này là NestJS API server.

## Stack
NestJS 10 · TypeScript 5.5 · TypeORM 0.3 · PostgreSQL · Redis (ioredis) · JWT + refresh rotation · Swagger

## Cấu trúc
```
src/
  configs/        # registerAs() factories + Joi env validation
  common/         # CORE tái sử dụng
    abstracts/    #   BaseEntity, TrackingEntity, BaseService<T> (generic CRUD + transaction threading)
    decorators/   #   @Public, @RequirePermissions, @CurrentUser
    dto/          #   BaseQueryDto (page/limit/sort/search)
    filters/      #   HttpExceptionFilter, TypeOrmExceptionFilter
    guards/       #   JwtAuthGuard (global), PermissionsGuard (global)
    interceptors/ #   TransformInterceptor (wrap response chuẩn)
    interfaces/   #   IBaseResponse, IPaginatedResult
    middlewares/  #   LoggerMiddleware
  libraries/
    redis/        # RedisModule global — cache dùng chung (fail-open)
  database/
    data-source.ts  # TypeORM CLI (migration), migrations/
  modules/        # feature modules (modular monolith theo domain)
    users/  auth/  rbac/  health/
  app.module.ts  main.ts
```

## Quy ước cốt lõi
1. **Mọi entity extends `BaseEntity`** (uuid, version, timestamps) hoặc `TrackingEntity` (+ createdBy/updatedBy).
2. **Service CRUD extends `BaseService<T>`** — có sẵn create/findMulti(pagination+search)/update/removeMulti. Method nào cần transaction: gọi `runInTransaction(manager => ...)` và truyền `manager` xuống các method con (idiom threading EntityManager).
3. **Route mặc định yêu cầu đăng nhập** (JwtAuthGuard global). Public phải gắn `@Public()`. Cần quyền: `@RequirePermissions('story:create')`.
4. **Response** tự wrap `{statusCode, message, data, timestamp}`; lỗi thống nhất `{statusCode, error, message, path, timestamp}`.
5. **Module mới** đặt trong `src/modules/<domain>/`, đủ entity/dto/service/controller/module; không import entity của module khác — giao tiếp qua service export.
6. **Prod dùng migration** (`npm run migration:generate|run`), `DB_SYNCHRONIZE=true` chỉ ở local dev.
7. **Cache** dùng `RedisService` (getJson/setJson/del/delByPrefix) — Redis chết app vẫn chạy (fail-open).

## Docs
- `01-evo-core-blueprint.md` — những gì rút từ EvoAutomationServer và lý do
- `02-token-architecture.md` — thiết kế access/refresh token (đã code trong `modules/auth`)
- `03-rbac-dynamic.md` — thiết kế RBAC động (đã code trong `modules/rbac` + guards)
- `04-audio-story-architecture.md` — nghiên cứu kiến trúc audio/truyện (CHƯA code, định hướng)
- `05-environments.md` — cấu hình env development/production
- `06-docker.md` — Dockerfile multi-stage + docker compose

## Chạy
```bash
cp .env.development.example .env.development   # sửa DB/Redis
npm install
npm run start:dev      # Swagger: http://localhost:3000/swagger
```
