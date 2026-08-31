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

## Chạy e2e test
E2E dùng cùng `configureHttpApplication()` với runtime thật, nên kiểm tra đúng prefix/version/pipe/cookie middleware. Cần PostgreSQL/Redis đang chạy, database riêng `meago_test` và credential trong `.env.test` phải khớp hạ tầng test:
```bash
cp .env.test.example .env.test          # sửa nếu cần, mặc định trỏ DB_PORT=5433 (giống dev)
npm run test:e2e
```
