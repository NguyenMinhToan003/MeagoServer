# Docker

## Dev hằng ngày (khuyến nghị)
Chỉ chạy hạ tầng trong Docker, API chạy ngoài host để hot-reload:
```bash
docker compose up -d postgres redis
npm run start:dev
```
Port/user/password lấy từ biến `DB_*`/`REDIS_*` (mặc định khớp `.env.development.example`).

## Chạy full stack (API trong container)
```bash
# JWT_ACCESS_SECRET bắt buộc phải set
JWT_ACCESS_SECRET=<secret> docker compose --profile app up -d --build
```
API container chạy `NODE_ENV=production`, `DB_SYNCHRONIZE=false` — schema tạo bằng migration:
```bash
docker compose exec api node -e "1"   # container không có ts-node; chạy migration từ host:
npm run migration:run
```
(Hoặc thêm bước migration vào CI/CD trước khi deploy.)

## Dockerfile
Multi-stage: `build` (npm ci + nest build) → `deps` (npm ci --omit=dev) → runtime `node:20-alpine`, chạy user `node` non-root, chỉ copy `dist/` + production node_modules. `.dockerignore` loại node_modules, env thật, docs.
