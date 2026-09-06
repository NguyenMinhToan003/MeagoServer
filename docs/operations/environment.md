# Cấu hình môi trường

> Theo chuẩn docs NestJS (https://docs.nestjs.com/techniques/configuration), không theo cách của dự án mẫu.

## Cơ chế
- `ConfigModule` load theo `NODE_ENV`: `.env.${NODE_ENV}` → fallback `.env`.
- **Biến môi trường hệ thống luôn ưu tiên hơn file** (mặc định của @nestjs/config) → prod inject secret qua container/CI, không cần file trên server.
- Mọi biến được validate bằng Joi (`src/configs/env.validation.ts`) — thiếu/sai là app từ chối boot ngay.
- TypeORM CLI (`data-source.ts`) và seed dùng cùng quy ước file.

## File
| File | Commit? | Dùng cho |
|---|---|---|
| `.env.development.example` | ✅ | template dev — copy thành `.env.development` |
| `.env.production.example` | ✅ | liệt kê biến bắt buộc cho prod |
| `.env.test.example` | ✅ | template e2e test — copy thành `.env.test` |
| `.env.development`, `.env.production`, `.env.test`, `.env` | ❌ (gitignore) | giá trị thật |

## Scripts
```bash
npm run start:dev    # NODE_ENV=development (cross-env, chạy được trên Windows)
npm run start:prod   # NODE_ENV=production, chạy dist/main
npm run test:e2e     # script cố định NODE_ENV=test trên mọi hệ điều hành
```

## Khác biệt dev vs prod vs test
| | Development | Production | Test (e2e) |
|---|---|---|---|
| Schema | `DB_SYNCHRONIZE=true` (iterate nhanh) | `false` — bắt buộc `npm run migration:run` | `true` — dựng schema sạch mỗi lần chạy |
| Database | `meago_dev` | database prod | `meago_test` — tách riêng, không đụng data dev |
| Secret | trong `.env.development` | env vars từ secret manager | trong `.env.test` (secret giả) |
| Cookie refresh | `secure: false` (theo NODE_ENV) | `secure: true` | `secure: false` |
| CORS | localhost | domain thật | localhost |

## Biến authentication mode

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `AUTH_MODE` | `jwt` | `jwt`: Bearer access token + refresh rotation. `session`: opaque cookie + Redis cache. Chỉ một mode cho mỗi deployment. |
| `SESSION_COOKIE_NAME` | `meago_sid` | Tên cookie session (chỉ dùng ở `session`). |
| `SESSION_IDLE_TTL_MINUTES` | `30` | Idle timeout, trượt theo touch. |
| `SESSION_ABSOLUTE_TTL_DAYS` | `14` | Absolute timeout; rotate/touch không kéo dài. |
| `SESSION_TOUCH_INTERVAL_SECONDS` | `60` | Khoảng tối thiểu giữa hai lần ghi `lastSeenAt`. |
| `SESSION_CACHE_TTL_SECONDS` | `300` | Trần TTL bản ghi session trong Redis; cửa sổ stale tối đa khi invalidate thất bại. |

Quy ước tên: khái niệm có ở cả hai mode mang tiền tố `JWT_` hoặc `SESSION_` (ví dụ `JWT_REFRESH_COOKIE_NAME` / `SESSION_COOKIE_NAME`); biến dùng chung không tiền tố (`AUTH_MODE`, `AUTH_LOCK_TIMEOUT_MS`, `PERMISSION_CACHE_TTL_MS`). Các biến `JWT_*` vẫn được validate khi boot ở cả hai mode (schema chung) nhưng chỉ dùng ở `jwt`.

## Chạy e2e test
E2E dùng cùng `configureHttpApplication()` với runtime thật, nên kiểm tra đúng prefix/version/pipe/cookie middleware. Cần PostgreSQL/Redis đang chạy, database riêng `meago_test` và credential trong `.env.test` phải khớp hạ tầng test:
```bash
cp .env.test.example .env.test          # sửa nếu cần, mặc định trỏ DB_PORT=5433 (giống dev)
npm run test:e2e
```
