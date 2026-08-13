# Cấu hình môi trường Development / Production

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
| `.env.development`, `.env.production`, `.env` | ❌ (gitignore) | giá trị thật |

## Scripts
```bash
npm run start:dev    # NODE_ENV=development (cross-env, chạy được trên Windows)
npm run start:prod   # NODE_ENV=production, chạy dist/main
```

## Khác biệt dev vs prod
| | Development | Production |
|---|---|---|
| Schema | `DB_SYNCHRONIZE=true` (iterate nhanh) | `false` — bắt buộc `npm run migration:run` |
| Secret | trong `.env.development` | env vars từ secret manager |
| Cookie refresh | `secure: false` (theo NODE_ENV) | `secure: true` |
| CORS | localhost | domain thật |
