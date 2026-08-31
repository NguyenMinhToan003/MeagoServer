# Observability và security controls

Trạng thái: **Implemented foundation** — 2026-08-31.

## Logging

`nestjs-pino` là HTTP/application logger duy nhất. Middleware log request thủ công đã bị loại bỏ để tránh duplicate record.

- Development dùng `pino-pretty`; production phát JSON một dòng.
- Mỗi request có `x-request-id`; ID hợp lệ từ upstream được giữ, nếu không Server tạo UUID.
- Log có `service` và `environment` để query tập trung.
- Authorization, cookie, set-cookie, password và token bị redact.
- Không log request/response body mặc định.

## Sentry

Sentry chỉ bật khi `SENTRY_DSN` có giá trị. `SENTRY_TRACES_SAMPLE_RATE` nằm trong `[0,1]`; development/test mặc định `0`.

- TypeORM error và HTTP 5xx được capture.
- HTTP 4xx không capture mặc định vì phần lớn là expected client behavior.
- Cookie, authorization và request body bị loại trước khi gửi.
- `APP_RELEASE` phải là immutable build identifier ở production.
- Sentry không thay structured logs, health checks hoặc metrics.

## Rate limiting

Global policy hiện tại là 120 request/phút. Auth override:

| Endpoint | Limit |
|---|---:|
| Register | 3/phút |
| Login | 5/phút |
| Refresh | 20/phút |

Ứng dụng đã bật `trust proxy = 1`. Deployment phải có đúng một trusted reverse proxy; nếu topology thay đổi phải cấu hình lại, không tăng giá trị tùy tiện.

Storage throttler hiện là in-memory và chỉ phù hợp một instance. Trước khi scale ngang phải thay bằng shared Redis storage và thêm test hai replica.

Khi vượt ngưỡng, `ThrottlerGuard` dừng request trước controller và trả HTTP `429 Too Many Requests`. Tracker hiện dựa trên IP do guard cung cấp; vì vậy `trust proxy = 1` là một phần của security boundary, không chỉ là cấu hình hạ tầng. Limit không thay authorization, quota nghiệp vụ hoặc chống abuse phân tán.

## Password hashing và validation

- Password dùng Argon2id qua `PasswordHasher` port; adapter cố định `m=19456`, `t=2`, `p=1` để policy không trôi theo default của package.
- Login không tồn tại email vẫn chạy một lần verify với dummy hash, giảm chênh lệch timing có thể dùng để dò tài khoản.
- DTO HTTP dùng `class-validator` và `class-transformer` vì tích hợp trực tiếp với Nest `ValidationPipe`. Zod không được thêm vào BE để tránh hai validation stack cho cùng boundary.

## Health

- `GET /api/v1/health/live`: process đang phục vụ request.
- `GET /api/v1/health/ready`: PostgreSQL sẵn sàng.
- `GET /api/v1/health`: compatibility alias của readiness hiện tại.

Redis là cache fail-open nên không làm readiness fail. Cần quan sát Redis qua log/metrics riêng; nếu Redis trở thành dependency bắt buộc cho session hoặc distributed throttling thì phải đưa Redis vào readiness.

## Gate trước production

- Kiểm tra redaction bằng automated test.
- Kiểm tra request ID propagation qua reverse proxy.
- Cấu hình Sentry source maps và release trong CI.
- Dùng Redis throttler storage trước khi chạy nhiều replica.
- Thêm metrics/OpenTelemetry khi có monitoring backend.
