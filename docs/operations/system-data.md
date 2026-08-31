# Dữ liệu hệ thống mặc định

Nguồn khai báo duy nhất là `src/database/default-data.ts`. File này chỉ chứa dữ liệu hệ thống không nhạy cảm:

- toàn bộ permission công bố bởi `@meago/core`;
- role `admin`, luôn được đồng bộ với toàn bộ permission đã đăng ký;
- giá trị admin mặc định chỉ dành cho development.

`src/database/seed.ts` là bootstrap executor. Nó chạy trong một transaction và idempotent:

- upsert permission theo `name`;
- tạo hoặc cập nhật role `admin` và gán full permission;
- tạo admin đầu tiên nếu email chưa tồn tại;
- nếu user đã tồn tại, chỉ bổ sung role admin, không xóa role khác;
- không bao giờ reset mật khẩu của admin đã tồn tại.

## Development

Khai báo trong `.env.development`, sau đó chạy:

```bash
npm run seed
```

Local có fallback `admin@meago.local` / `local-admin-change-me`, chỉ để khởi tạo máy phát triển.

## Production

Ba biến được dùng:

- `BOOTSTRAP_ADMIN_EMAIL` — bắt buộc;
- `BOOTSTRAP_ADMIN_DISPLAY_NAME` — mặc định `Meago Administrator`;
- `BOOTSTRAP_ADMIN_PASSWORD` — bắt buộc, tối thiểu 12 ký tự, truyền qua secret manager.

Production Compose mount mật khẩu thành `BOOTSTRAP_ADMIN_PASSWORD_FILE`. Luồng deploy là:

```text
migrate -> bootstrap system data -> API -> Web
```

Có thể chạy thủ công trên artifact đã build bằng `npm run seed:prod`. Sau lần tạo đầu tiên, đổi mật khẩu qua use case quản trị/password reset; sửa secret bootstrap không tự đổi mật khẩu hiện hữu.

Không đưa credential thật vào `default-data.ts`, migration, Git hoặc Docker image.
