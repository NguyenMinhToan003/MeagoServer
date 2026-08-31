# Docker và triển khai container

## Mục tiêu thiết kế

Docker ở đây là thiết kế riêng theo runtime của Meago, không sao chép bố cục từ dự án mẫu:

- `compose.yaml`: topology chung và policy runtime.
- `compose.dev.yaml`: chỉ mở port và cấp credential an toàn cho local.
- `compose.prod.yaml`: migration gate, Docker secrets, filesystem read-only và Next.js standalone.
- Redis là cache/phụ trợ; API không phụ thuộc health của Redis để khởi động.
- PostgreSQL là dependency bắt buộc; production chạy migration thành công trước khi API được start.

## Local development

Chạy PostgreSQL và Redis trong Docker, API/FE chạy trên host để có hot reload:

```bash
docker compose --env-file .env.development -f compose.yaml -f compose.dev.yaml up -d postgres redis
npm run start:dev
```

Nếu PostgreSQL/Redis native đã chiếm `5432`/`6379`, đổi `DB_PORT`/`REDIS_PORT` trong `.env.development` rồi chạy lại. Port trong container vẫn là `5432`/`6379`.

Muốn kiểm tra API image ở local:

```bash
docker compose --env-file .env.development -f compose.yaml -f compose.dev.yaml --profile app up -d --build
```

## Production self-host

Các biến không bí mật bắt buộc: `DB_USERNAME`, `DB_DATABASE`, `CORS_ORIGINS`. Các secret bắt buộc: `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_ACCESS_SECRET`. Compose chuyển secret thành file `/run/secrets/*`; ứng dụng hỗ trợ convention `*_FILE`, nên giá trị không nằm trong environment của container API.

```bash
docker compose -f compose.yaml -f compose.prod.yaml --profile app config --quiet
docker compose -f compose.yaml -f compose.prod.yaml --profile app up -d --build
```

Luồng khởi động:

```text
PostgreSQL healthy -> migrate -> bootstrap admin -> API healthy -> Web start
Redis -----------------------------------------------> cache tùy chọn của API
```

`migrate` và `bootstrap` dùng đúng backend runtime image; không chạy chúng trong mỗi API replica. `DB_SYNCHRONIZE` luôn là `false` ở production. Bootstrap idempotent và không reset mật khẩu admin đã tồn tại; xem [dữ liệu hệ thống mặc định](system-data.md).

## Runtime hardening đã áp dụng

- Backend và frontend chạy bằng user `node`, không chạy root.
- `init: true` chuyển signal đúng; Nest bật shutdown hooks để đóng connection sạch.
- Production API/Web dùng root filesystem read-only và chỉ cấp `/tmp` dạng `tmpfs`.
- `no-new-privileges`, healthcheck riêng, restart policy và giới hạn log JSON.
- Chỉ Web publish port; API, PostgreSQL và Redis ở mạng nội bộ Compose.
- Frontend build `output: standalone`; `/api/*` proxy cùng origin tới API nội bộ.

## Boundary vận hành

- TLS, WAF và public rate limit thuộc reverse proxy/load balancer bên ngoài Compose.
- Backup/restore PostgreSQL và Redis phải do nền tảng deploy quản lý và diễn tập định kỳ.
- CPU/memory limit phải được đặt ở manifest của môi trường đích sau load test; không hard-code một con số giả định vào topology dùng chung.
- Tag `node:24-alpine`, `postgres:16-alpine`, `redis:7-alpine` cố ý theo major/LTS để dễ cập nhật local. Pipeline release nên resolve và khóa image digest sau khi scan, sau đó cập nhật bằng PR tự động.
- Không dùng `docker compose down -v` trên môi trường có dữ liệu: `-v` xóa volume.

## Quality gates

```bash
docker compose -f compose.yaml -f compose.dev.yaml --profile app config --quiet
npm run build
npm test -- --runInBand
```

Production config cần truyền đầy đủ biến bắt buộc trước khi chạy `config --quiet`. Docker daemon phải đang hoạt động mới kiểm tra được `docker build` hoặc khởi động stack.
