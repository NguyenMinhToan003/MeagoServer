# JWT clean-break status

## Quyết định

Không hỗ trợ access token legacy. Sau deploy, người dùng đăng nhập lại một lần. Token mới bắt buộc có:

```text
sub, sid, jti, iss, aud, iat, exp
```

Verify cố định `HS256`, issuer và audience từ typed configuration. Secret tối thiểu 32 ký tự.

## Refresh rotation

- Login và issue credential chạy trong transaction.
- Refresh lookup dùng row lock `pessimistic_write` theo token hash.
- Successor được tạo và token cũ được burn trong cùng transaction.
- Access JWT dùng `sid` thật của successor refresh session.
- Không lưu raw refresh token.
- Absolute family expiry không được kéo dài khi rotate.
- Reuse ngoài grace window revoke toàn family và commit trước khi trả lỗi.
- Request thua race trong grace window nhận `409 AUTH_REFRESH_RACE`, không revoke nhầm family.

## Client

Browser dùng Web Locks để serialize refresh xuyên tab/window. Access token vẫn chỉ nằm trong memory. Interceptor chỉ loại login/refresh khỏi auto-refresh; `/auth/me` được phép renew bình thường.

## Cấu hình mới

```env
JWT_ISSUER=meago-server
JWT_AUDIENCE=meago-client
REFRESH_RACE_GRACE_SECONDS=5
```

Production phải cung cấp secret ngẫu nhiên riêng, không dùng credential development/test.

## Quality gate hiện tại

- Unit suites auth/guard/adapter pass.
- Type-check Server/Client pass.
- Production build Server/Client bắt buộc pass trước bàn giao.
- `npm audit` bắt buộc bằng 0.

PostgreSQL concurrency integration test vẫn là gate tiếp theo trước khi tuyên bố refresh flow production-ready.

## Pre-commit verification 2026-08-31

- MeagoLibrary: strict type-check, ESM/CJS build, smoke test và package dry-run đều pass.
- MeagoServer: lint, production build và 14/14 unit tests đều pass; `npm audit` báo 0 vulnerability.
- MeagoClient: lint, TypeScript check trong Next build và production build đều pass; `npm audit` báo 0 vulnerability.
- Secret scan không tìm thấy npm token hoặc private key trong ba repository.
- `git diff --check` không còn whitespace error hoặc conflict marker.
- MeagoLibrary còn 1 cảnh báo low severity trong `esbuild` development toolchain; không có runtime dependency và không đạt ngưỡng high severity.
- Server E2E chưa pass trên máy kiểm tra vì PostgreSQL test từ chối credential và Redis không sẵn sàng. Đây vẫn là release blocker cho integration gate, không được ghi nhận là test pass.
