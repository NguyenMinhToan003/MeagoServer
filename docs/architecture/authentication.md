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
- Mọi mutation auth lấy transaction advisory lock theo thứ tự cố định `user -> refresh family`, sau đó rotation khóa session row bằng `FOR UPDATE`. Vì vậy rotate, reuse detection và logout-all không thể chạy xuyên qua nhau.
- Lock wait có giới hạn bởi `AUTH_LOCK_TIMEOUT_MS`; không giữ transaction trong lúc gọi dịch vụ ngoài.
- Race trong grace window trả `AUTH_REFRESH_RACE`; reuse thật revoke toàn family.
- Client giữ access token trong memory: Promise tạo single-flight trong một tab; Web Lock bầu tab thực hiện rotation; BroadcastChannel chia sẻ kết quả cho các tab đang chờ.

## Session strategy tùy chọn

- Cookie chỉ chứa opaque session ID; server lưu principal, expiry và revoke state trong shared store.
- Bắt buộc Redis/database shared store, TTL, rotation khi privilege thay đổi, CSRF policy và readiness dependency.
- Session strategy chưa được wire vào MeagoServer; boundary đã sẵn sàng nhưng không được ghi nhận là implemented.

## Password

Password dùng Argon2id sau `PasswordHasher` port với `m=19456`, `t=2`, `p=1`. Unknown account vẫn chạy dummy verification để giảm timing enumeration. Không migrate bcrypt vì hệ thống chưa có dữ liệu thật.

## Security invariants

- Raw refresh/session credential không xuất hiện trong DB, log, Sentry hoặc response ngoài điểm cấp credential.
- Logout revoke refresh session hiện tại; logout-all revoke mọi refresh session của subject. Access JWT đã cấp vẫn sống tối đa tới `exp`, nên TTL access phải ngắn; nếu dự án yêu cầu revoke access tức thời thì chọn stateful session hoặc session-version lookup.
- JWT/session test phải kiểm tra issuer, audience, expiry, revoke, concurrent rotation và reuse.

Email đăng nhập được trim/lowercase tại HTTP và service boundary; database giữ unique constraint cùng normalized-email check. Unique violation là lớp quyết định cuối và được map về `AUTH_EMAIL_ALREADY_EXISTS` thay vì lỗi 500.
