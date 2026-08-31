# Authentication: JWT và stateful session

## Boundary chung

Application và authorization chỉ nhận `AuthPrincipal`. Guard phụ thuộc `AuthenticationPort`, không phụ thuộc trực tiếp JWT. Mỗi dự án có thể chọn một strategy tại composition root:

- JWT: access token ngắn hạn + opaque refresh token rotation.
- Stateful session: opaque session ID trong cookie + session store dùng chung.

Không chạy đồng thời hai mode cho cùng route nếu chưa có migration policy rõ ràng.

## JWT strategy hiện tại

- Access JWT bắt buộc có `sub`, `sid`, `jti`, `iss`, `aud`, `iat`, `exp`; verify cố định HS256, issuer và audience.
- Refresh token là random opaque 256-bit, chỉ lưu SHA-256 hash trong database.
- Refresh cookie là `HttpOnly`, `SameSite=Lax`, `Secure` ở production và giới hạn path auth.
- Mỗi login tạo một token family và absolute expiry; rotation không kéo dài family vô hạn.
- Consume refresh chạy trong transaction với pessimistic lock, tạo successor rồi đánh dấu token cũ đã thay thế.
- Race trong grace window trả `AUTH_REFRESH_RACE`; reuse thật revoke toàn family.
- Client giữ access token trong memory và phối hợp refresh một lần trước khi retry request.

## Session strategy tùy chọn

- Cookie chỉ chứa opaque session ID; server lưu principal, expiry và revoke state trong shared store.
- Bắt buộc Redis/database shared store, TTL, rotation khi privilege thay đổi, CSRF policy và readiness dependency.
- Session strategy chưa được wire vào MeagoServer; boundary đã sẵn sàng nhưng không được ghi nhận là implemented.

## Password

Password dùng Argon2id sau `PasswordHasher` port với `m=19456`, `t=2`, `p=1`. Unknown account vẫn chạy dummy verification để giảm timing enumeration. Không migrate bcrypt vì hệ thống chưa có dữ liệu thật.

## Security invariants

- Raw refresh/session credential không xuất hiện trong DB, log, Sentry hoặc response ngoài điểm cấp credential.
- Logout revoke session hiện tại; logout-all revoke toàn bộ credential của subject.
- JWT/session test phải kiểm tra issuer, audience, expiry, revoke, concurrent rotation và reuse.
