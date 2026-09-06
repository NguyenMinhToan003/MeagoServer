# MeagoServer — hướng dẫn bắt buộc cho AI

Đọc `C:\Meago\AGENTS.md` trước, sau đó đọc file này trước khi phân tích hoặc thay đổi backend. Quy tắc tại đây áp dụng cho toàn bộ `MeagoServer` và cụ thể hơn quy tắc workspace.

## Điểm vào và nguồn sự thật

1. `docs/README.md` — định tuyến tài liệu canonical.
2. `docs/reference/technology-stack.md` — công nghệ đang dùng và trạng thái áp dụng.
3. `docs/architecture/system.md` — module, dependency direction và request flow.
4. `docs/architecture/authentication.md` — JWT/session boundary và refresh rotation; `docs/architecture/identity-principles.md` giải thích nguyên lý định danh hai mode.
5. `docs/architecture/concurrency.md` — transaction, optimistic và pessimistic lock.
6. `docs/standards/quality-gates.md` — gate trước khi bàn giao.
7. `docs/standards/database-query-rules.md` — total order, cursor pagination và composite index bắt buộc khi sửa query/list.
8. `docs/standards/coding-rules.md` — invariant coding, lỗi bị cấm và checklist review backend.

Code và test đang chạy là nguồn sự thật về behavior. Migration là nguồn sự thật của production database schema; `src/database/default-data.ts` là nguồn khai báo system data mặc định.

## Bản đồ source

| Thay đổi | Vị trí chính |
|---|---|
| Composition/global provider | `src/app.module.ts`, `src/main.ts` |
| Controller/DTO/use case | `src/modules/<domain>` |
| Authentication port/guard | `src/common/auth`, `src/common/guards` |
| JWT/session adapter, refresh | `src/modules/auth` |
| Password hashing | `src/common/security` |
| RBAC | `src/modules/rbac` |
| Entity/migration/bootstrap data | `src/database`, entity trong module |
| Redis | `src/libraries/redis` |
| Env/logging/Sentry | `src/configs`, `src/instrument.ts` |
| Upload boundary | `src/modules/uploads` |
| Docker/deploy | `Dockerfile`, `compose*.yaml`, `docs/operations` |

Dependency direction: `controller/guard -> application service -> port <- infrastructure adapter`. Không đưa NestJS, Express hoặc TypeORM vào `@meago/core`. Entity không phải API contract.

## Quy tắc backend

Mọi code mới hoặc boundary đang sửa phải tuân thủ `docs/standards/coding-rules.md`; rule database chuyên sâu nằm tại `docs/standards/database-query-rules.md`.

- Route mặc định được bảo vệ; public endpoint phải opt-in bằng `@Public()`.
- Authentication chạy trước authorization. Controller không parse JWT và không tự truy vấn permission.
- Application dùng `AuthPrincipal` và authentication port trung lập; lựa chọn JWT/session nằm ở composition root.
- Password dùng `PASSWORD_HASHER`/Argon2 adapter, không gọi thư viện hash trực tiếp trong use case.
- Production luôn `DB_SYNCHRONIZE=false`; mọi schema change phải có migration mới. Không sửa migration đã phát hành.
- CRUD do người dùng chỉnh sửa phải dùng version compare-and-swap; read-decide-write quan trọng dùng transaction và pessimistic lock theo `docs/architecture/concurrency.md`.
- Query có pagination phải có total order xác định, cursor đầy đủ và index theo query shape; tuân thủ `docs/standards/database-query-rules.md`.
- Dữ liệu hệ thống khai báo tại `src/database/default-data.ts`; credential chỉ đến từ environment/secret. Bootstrap phải idempotent và không reset mật khẩu hiện hữu.
- Redis là cache/phụ trợ trừ khi tài liệu của capability quy định khác; lỗi Redis không được làm hỏng nguồn dữ liệu chính.
- Không log token, cookie, password hoặc secret. Giữ request ID và structured logging.
- Không chạy `npm audit fix` tự động và không nâng dependency ngoài phạm vi khi chưa đánh giá behavior.

## Docs phải cập nhật cùng code

| Khi thay đổi | Tài liệu canonical |
|---|---|
| Module/boundary/folder | `docs/architecture/system.md`, sơ đồ backend nếu topology đổi |
| Auth/JWT/refresh/session | `docs/architecture/authentication.md` |
| RBAC/permission | `docs/architecture/rbac.md` |
| Shared core contract | `docs/architecture/core-foundation.md` và MeagoLibrary |
| Upload/storage | `docs/architecture/upload.md` |
| Env/Docker/bootstrap | `docs/operations/environment.md`, `docker.md`, `system-data.md` |
| Logging/Sentry/health/throttle | `docs/operations/observability-security.md` |
| Audit action/schema/retention | `docs/architecture/audit-trail.md`, observability docs và migration tương ứng |
| Dependency | `docs/reference/technology-stack.md` |
| Query, sorting, pagination, database index | `docs/standards/database-query-rules.md` và migration tương ứng |
| Coding convention hoặc invariant xuyên layer | `docs/standards/coding-rules.md` |

Không tạo docs trạng thái theo phase; cập nhật trực tiếp tài liệu canonical. Research/Deferred không được mô tả như đã triển khai.

## Gate trước khi kết thúc

```bash
npm run build
npm test -- --runInBand
npx eslint <các file TypeScript đã thay đổi>
git diff --check
```

Nếu thay Compose, chạy thêm `docker compose ... config --quiet`. Chỉ báo Docker image đã kiểm chứng khi daemon thực sự chạy và `docker build` thành công. Luôn giữ nguyên thay đổi không liên quan và không tự commit.
