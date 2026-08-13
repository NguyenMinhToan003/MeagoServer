# MeagoServer

Nền tảng đăng tải, chia sẻ **audio / truyện** — NestJS + PostgreSQL + Redis.

📖 Bắt đầu từ [docs/00-overview.md](docs/00-overview.md) — cấu trúc, quy ước core, và các tài liệu thiết kế:

- [01 — Core rút từ EvoAutomationServer](docs/01-evo-core-blueprint.md)
- [02 — Token architecture (access + refresh rotation)](docs/02-token-architecture.md)
- [03 — RBAC động](docs/03-rbac-dynamic.md)
- [04 — Nghiên cứu kiến trúc audio/truyện](docs/04-audio-story-architecture.md)
- [05 — Env development/production](docs/05-environments.md)
- [06 — Docker](docs/06-docker.md)

## Quick start
```bash
cp .env.development.example .env.development    # sửa DB/Redis
docker compose up -d postgres redis             # hạ tầng local
npm install
npm run seed            # tạo permissions + role admin + user admin@meago.local
npm run start:dev       # Swagger: http://localhost:3000/swagger
```
