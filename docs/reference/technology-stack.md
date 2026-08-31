# Technology stack — hệ thống Meago

Đây là bản đồ công nghệ để nắm nhanh ba codebase. Version chính xác luôn lấy từ `package.json` và lockfile của từng repo.

## MeagoServer

| Nhóm | Công nghệ | Vai trò |
|---|---|---|
| Runtime | Node.js, TypeScript, NestJS | API modular monolith và dependency injection |
| HTTP | Express adapter, Helmet, Compression, Cookie Parser | HTTP transport và baseline security |
| Database | PostgreSQL, TypeORM, `pg` | Persistence và transaction; migration là nguồn schema production |
| Cache/coordination | Redis, ioredis | Permission cache; tương lai session/distributed throttle |
| Authentication | Passport-independent guard, JWT, opaque refresh token, Argon2id | Strategy boundary, access credential và password hashing |
| Validation/config | class-validator, class-transformer, Joi, `@nestjs/config` | DTO boundary và fail-fast environment validation |
| Authorization | Permission-based RBAC | Role là data; code kiểm tra permission string |
| Logging | nestjs-pino, Pino | Structured log, request ID và secret redaction |
| Monitoring | Sentry, Terminus | Error capture, liveness và readiness |
| Abuse control | `@nestjs/throttler` | Rate limit global/auth; memory storage khi single-instance |
| API docs | Swagger | OpenAPI development contract |
| Test | Jest, Supertest | Unit/integration/E2E foundation |
| Deployment | Docker multi-stage, Compose dev/prod, Docker secrets | Non-root runtime, migration gate và health orchestration |

Zod không dùng tại BE HTTP boundary vì DTO Nest đã thống nhất bằng class-validator/class-transformer. Sentry không thay logs hoặc metrics. Throttler phải chuyển sang Redis storage trước khi chạy nhiều replica.

## MeagoClient

| Nhóm | Công nghệ | Vai trò |
|---|---|---|
| Runtime/UI | Next.js App Router, React, TypeScript | SSR/RSC và client interaction |
| Styling | Tailwind CSS, shadcn/ui, Radix | Token, primitive và accessible interaction |
| State/data | TanStack Query, Zustand, Axios | Server cache, client state và HTTP transport |
| Form/i18n | React Hook Form, Zod, next-intl | Form boundary và đa ngôn ngữ |
| Advanced UI | TanStack Table/Virtual, Infinite Query, cmdk, Driver.js, dnd-kit | Table, cursor feed, virtual list, command, tour và accessible reorder |

Chi tiết FE nằm trong `MeagoClient/docs/reference/technology-stack.md`.

## MeagoLibrary

`@meago/core` là package TypeScript framework-neutral dùng chung contract, auth principal/strategy, response/error/result, pagination và port nền tảng. Package không phụ thuộc NestJS, React, TypeORM hoặc domain audio. Server và Client hiện pin exact `@meago/core@0.2.0`.
