# MeagoServer

Nền tảng đăng tải, chia sẻ **audio / truyện** — NestJS + PostgreSQL + Redis.

📖 [Mục lục tài liệu](docs/README.md) · [Technology stack](docs/reference/technology-stack.md) · [Core foundation](docs/architecture/core-foundation.md) · [Kiến trúc hệ thống](docs/architecture/system.md) · [Nguồn draw.io](docs/diagrams/backend-architecture.drawio)

## Quick start

```bash
cp .env.development.example .env.development              # sửa DB/Redis
docker compose --env-file .env.development -f compose.yaml -f compose.dev.yaml up -d postgres redis
npm install
npm run seed            # tạo permissions + role admin + user admin@meago.local
npm run start:dev       # Swagger: http://localhost:9000/swagger
```

Lưu ý: nếu máy đã cài PostgreSQL/Redis native (Windows service) chiếm sẵn port 5432/6379, đổi `DB_PORT`/`REDIS_PORT` trong `.env.development` sang port khác (vd. `5433`). Xem [Docker và triển khai container](docs/operations/docker.md) cho full-stack production, migration gate và secret handling.
