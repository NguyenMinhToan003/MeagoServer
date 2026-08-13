# Thiết kế Token Architecture (Access + Refresh, auto-refresh)

> Trạng thái: THIẾT KẾ ĐÃ CHỐT — sẽ code trong phần nền móng.

## Bối cảnh
Docs chính thức NestJS (https://docs.nestjs.com/security/authentication) chỉ hướng dẫn JWT access token + AuthGuard cơ bản, **không cover refresh token** — phần refresh thiết kế theo best practice cộng đồng dưới đây.

## Nguyên tắc
- **Access token**: JWT, TTL ngắn **15 phút**, stateless, không lưu DB. Payload tối thiểu: `sub`, roles.
- **Refresh token**: chuỗi random opaque 256-bit (KHÔNG phải JWT), TTL **14 ngày**, có absolute expiry (rotate bao nhiêu cũng không sống quá mốc này).
- **Hash trước khi lưu DB** (SHA-256) — lộ DB cũng không dùng được token.
- **Rotation**: mỗi lần refresh → cấp cặp token mới, token cũ vô hiệu ngay ("burn on use").
- **Reuse detection**: refresh token đã-rotate bị dùng lại → token bị đánh cắp → **revoke toàn bộ token family** → 401 buộc login lại.
- **httpOnly cookie** cho web: `HttpOnly; Secure; SameSite=Lax; Path=/auth/refresh` — XSS không đọc được. Mobile app (nếu có) trả trong body, lưu Secure Storage.
- **Multi-device**: mỗi login = 1 session row riêng (device info, IP, user-agent) → logout từng thiết bị, có thể làm màn hình "Active sessions".

## Schema bảng `refresh_sessions`
```
id (uuid) | user_id | token_hash (SHA-256) | family_id (uuid)
device_info | ip | expires_at | revoked_at | replaced_by | created_at
```

## Luồng
1. **Login** → access JWT (body) + refresh token (cookie httpOnly); lưu hash + `family_id` mới.
2. **POST /auth/refresh** → hash token, tra DB:
   - Hợp lệ, chưa revoke → rotate: đánh dấu row cũ `replaced_by`, tạo row mới cùng `family_id`, trả cặp mới.
   - Đã replace/revoke → **reuse detected** → revoke cả family → 401.
3. **Logout** → revoke row + clear cookie. "Logout all devices" → revoke mọi row của user.
4. **Client**: axios interceptor bắt 401 → gọi `/auth/refresh` (có queue chống refresh song song) → retry request.

## Lý do chọn phương án này
- Opaque token cho refresh: revoke tức thì, không cần blacklist Redis.
- Lưu Postgres sẵn có (1 query theo index hash là đủ ở quy mô nhỏ-vừa), không thêm Redis chỉ vì auth.
- Cookie httpOnly là mặc định an toàn nhất cho web client.
- Đổi mật khẩu → revoke mọi session của user.

## Nguồn tham khảo
- https://docs.nestjs.com/security/authentication
- https://syskool.com/refresh-tokens-and-token-rotation-in-nestjs-secure-jwt-authentication/
- https://codecondo.com/jwt-refresh-token-rotation/
- https://samuelrods.com/en/blog/jwt-refresh-tokens-nestjs/
- https://dzone.com/articles/nodejs-refresh-tokens
- https://dev.to/apu_emdad/understanding-cookies-access-refresh-tokens-with-nodejs-di
- https://medium.com/@alperkilickaya/creating-a-jwt-authentication-system-with-http-only-refresh-token-using-react-and-node-js-6865f04087ce
