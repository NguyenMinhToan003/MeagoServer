# Authentication boundary status

## Hoàn thành

Ngày thực hiện: 2026-08-31.

- Thay global `JwtAuthGuard` bằng transport-neutral `AuthenticationGuard`.
- Tạo `AUTHENTICATION_PORT` và `AuthenticationPort`.
- Bọc verify JWT trong `JwtAuthenticationAdapter`.
- Request/controller/RBAC sử dụng `AuthPrincipal` từ `@meago/core` thay cho `IJwtUser`.
- Compatibility shim đã được loại bỏ trong clean-break phase; access token thiếu `sid/jti` không hợp lệ.
- HTTP endpoint, cookie và response contract chưa thay đổi.
- Bỏ `uuid` ESM dependency; dùng `crypto.randomUUID()` của Node.

## Regression coverage

- Public route bypass.
- Missing/invalid bearer token.
- Principal attachment.
- JWT payload mapping và legacy compatibility.
- Invalid credentials không làm lộ email tồn tại.
- Login lưu refresh-token hash thay vì raw token.
- Reuse token gọi revoke family.

Kết quả hiện tại: 3 test suites, 11 tests pass.

## Dependency security

- `@nestjs/swagger` được pin `11.4.7`.
- Dependency `js-yaml` vulnerable đã được thay bằng bản vá.
- `npm audit`: 0 vulnerabilities.

## Công việc tiếp theo

1. Thêm PostgreSQL integration test chạy hai refresh thật sự đồng thời.
2. Bổ sung migration/index review cho refresh session ở production schema.
3. Sau khi JWT flow ổn định, implement `SessionAuthenticationAdapter`.
