# Docker

## Dev hằng ngày (khuyến nghị)
Chỉ chạy hạ tầng trong Docker, API chạy ngoài host để hot-reload:
```bash
cp .env.development.example .env.development     # nếu chưa có
docker compose --env-file .env.development up -d postgres redis
npm run start:dev
```
Port/user/password lấy từ biến `DB_*`/`REDIS_*` trong `.env.development` (không phải `.env.development.example` — `docker compose` không tự đọc file `.env.<NODE_ENV>`, phải truyền `--env-file` tường minh như trên, nếu không sẽ báo thiếu `JWT_ACCESS_SECRET`).

### Port bị chiếm bởi PostgreSQL/Redis cài native trên máy
Nếu máy đã cài PostgreSQL (vd. qua installer Windows, chạy như Windows Service `postgresql-x64-*`) hoặc Redis native, nó thường tự chạy nền và chiếm sẵn port mặc định `5432`/`6379`. Khi đó container Docker start OK và `healthy`, nhưng app kết nối từ host lại bị route nhầm vào service native (không phải container) và báo `password authentication failed` dù password đúng — vì thực chất connection chưa từng tới container.

Cách nhận biết: `docker logs <container>` không ghi log connection nào ứng với lần bạn thử kết nối từ host.

Cách fix: đổi port container sang port trống, không cần tắt service native:
```bash
# .env.development
DB_PORT=5433
REDIS_PORT=6380
```
`docker-compose.yml` map `${DB_PORT:-5432}:5432` nên container bên trong vẫn dùng 5432 như cũ — chỉ port expose ra host đổi. Restart lại:
```bash
docker compose --env-file .env.development down
docker compose --env-file .env.development up -d postgres redis
```

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
Multi-stage: `build` (npm ci + nest build) → `deps` (npm ci --omit=dev) → runtime `node:24-alpine`, chạy user `node` non-root, chỉ copy `dist/` + production node_modules, expose `9000` (khớp `PORT` mặc định). `.dockerignore` loại node_modules, env thật, docs.
