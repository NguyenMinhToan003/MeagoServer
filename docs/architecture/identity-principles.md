# Nguyên lý định danh: JWT và stateful session trong MeagoServer

Tài liệu này giải thích **cách server biết "request này là của ai"** ở hai chế độ `AUTH_MODE=jwt` và `AUTH_MODE=session`, và vì sao hai chế độ được thiết kế tách bạch. Đọc trước [authentication.md](authentication.md) (đặc tả) và [rbac.md](rbac.md) (phân quyền); tài liệu này chỉ giải thích nguyên lý, không thay đặc tả.

## 1. Câu hỏi cốt lõi

HTTP không có trí nhớ. Mỗi request đến server là một sự kiện độc lập; server phải tự trả lời "ai đang gọi?" từ chính request đó. Có đúng hai cách trả lời:

| | Stateless (JWT) | Stateful (session) |
|---|---|---|
| Request mang gì | Một **bằng chứng tự chứa**: JWT có chữ ký của server | Một **chìa khoá vô nghĩa**: session ID ngẫu nhiên |
| Server làm gì | Kiểm tra chữ ký bằng toán học, **không tra cứu** | Tra cứu ID trong store, **bắt buộc** |
| Danh tính nằm ở đâu | Trong token (payload đã ký) | Trong store; token chỉ là con trỏ |
| Thu hồi giữa chừng | Không thể — chỉ chờ hết hạn | Tức thì — xoá/đánh dấu bản ghi |
| Chi phí mỗi request | 0 I/O | 1 GET Redis (miss → 1 SELECT) |
| Điểm yếu cần bù | Không revoke được → TTL phải ngắn (15 phút) + refresh token stateful | Cookie tự gửi → cần CSRF; store là hot path → cần cache |

Không có cách nào "đúng hơn". Dự án hỗ trợ cả hai, chọn bằng một biến môi trường, và **không lai** — mỗi deployment chạy đúng một cách.

## 2. Chế độ `jwt` — bằng chứng tự chứa

### 2.1 Định danh mỗi request

Client gửi `Authorization: Bearer <JWT>`. JWT gồm `header.payload.signature`, trong đó `signature = HMAC-SHA256(header + payload, JWT_ACCESS_SECRET)`. Chỉ server nắm secret nên chỉ server tạo được chữ ký hợp lệ.

`JwtAuthenticationAdapter` tính lại HMAC và so với chữ ký kèm theo, đồng thời kiểm tra `iss`, `aud`, `exp` và bắt buộc có `sub` (userId), `sid` (session id), `jti`. Khớp → tin payload → `AuthPrincipal { subjectId: sub, sessionId: sid, email }`. Không có query nào.

Hệ quả trực tiếp: **logout không làm access token chết**. Nó chỉ sống tối đa `JWT_ACCESS_TTL` = 15 phút. Đây là lý do TTL ngắn là bắt buộc, không phải tuỳ chọn.

### 2.2 Refresh token — phần stateful bắt buộc của JWT mode

Để user không phải đăng nhập lại mỗi 15 phút, server cấp thêm refresh token: 32 byte ngẫu nhiên, **không tự chứa gì**, chỉ dùng để tra bảng `refresh_sessions`. Bảng lưu `sha256(token)` — lộ DB không dùng được token.

Ba khái niệm trong bảng:

- **session** (1 row) = 1 thế hệ token cụ thể.
- **family** (`familyId`) = 1 lần đăng nhập, sống qua nhiều lần refresh. Login mới → family mới; điện thoại và laptop là hai family độc lập.
- **absolute expiry** (`expiresAt`) = mốc chết cứng của cả family, đặt lúc login (`JWT_REFRESH_TTL_DAYS` = 14 ngày); rotate không kéo dài.

Rotation: mỗi `/auth/refresh` tạo row mới cùng family, row cũ được đánh dấu `revokedAt` + `replacedBy`. Nhờ `replacedBy`, server phát hiện được **token cũ bị dùng lại** (dấu hiệu bị đánh cắp) và revoke cả family — nhưng chỉ family đó, thiết bị khác không ảnh hưởng. Trong 5 giây đầu (`JWT_REFRESH_RACE_GRACE_SECONDS`) dùng lại được coi là hai tab đua nhau → 409, không giết family.

Mọi mutation lấy advisory lock theo thứ tự cố định `user → family` rồi `SELECT … FOR UPDATE` row session, nên rotate, reuse detection và logout-all không chạy xuyên nhau.

### 2.3 Vận chuyển

Access token trong body (`ITokenResponse { accessToken, expiresIn }`), client giữ trong memory và tự gắn header — vì JS tự gắn nên **miễn nhiễm CSRF**. Refresh token trong cookie `meago_rt` HttpOnly, `path=/api/v1/auth` — trình duyệt chỉ gửi kèm khi gọi refresh/logout, không rò sang API thường.

## 3. Chế độ `session` — chìa khoá tra cứu

### 3.1 Định danh mỗi request

Client gửi cookie `meago_sid` chứa session ID 256-bit ngẫu nhiên (OWASP yêu cầu tối thiểu 64-bit). ID **không mang thông tin gì**; store giữ `sha256(ID)` làm khoá.

`SessionAuthenticationAdapter`: hash ID → `SESSION_STORE.findById` → kiểm tra `revokedAt`, idle `expiresAt`, `absoluteExpiresAt` → `AuthPrincipal { subjectId, sessionId: hash, email }` (email lấy từ cột `data` của session, không query user).

Hệ quả: **logout, logout-all, khoá tài khoản có hiệu lực ngay** ở request kế tiếp, vì bản ghi là nguồn sự thật.

### 3.2 Hai mốc hết hạn

- **Idle** (`SESSION_IDLE_TTL_MINUTES` = 30): trượt theo hoạt động. Mỗi request, nếu `lastSeenAt` cũ hơn 60 giây (`SESSION_TOUCH_INTERVAL_SECONDS`) thì ghi `lastSeenAt`/`expiresAt` mới — fire-and-forget, không ghi mỗi request.
- **Absolute** (`SESSION_ABSOLUTE_TTL_DAYS` = 14): đặt lúc login, rotate/touch không đổi. Cookie có `expires` = absolute; idle do server quyết định, không phụ thuộc cookie.

`/auth/refresh` ở mode này là **rotate ID** (giữ absolute) — dùng sau khi đổi quyền theo khuyến nghị OWASP. Rotation serialize bằng `UPDATE … WHERE revokedAt IS NULL`: hai renew đồng thời chỉ một cái `affected = 1`.

### 3.3 Redis là cache, Postgres là sự thật

Store là hot path nên có `CachedSessionStore` bọc `PostgresSessionStore`. Để cache **đáng tin**, có đúng năm quy tắc (chi tiết trong authentication.md):

1. Chỉ đường đọc được `SET`, luôn kèm TTL = min(idle còn lại, `SESSION_CACHE_TTL_SECONDS` = 300).
2. Mọi đường ghi: Postgres commit trước, rồi chỉ `DEL` — không `SET` (tránh đè giá trị mới bằng giá trị cũ khi có đọc song song).
3. Không cache session đã revoke / không tồn tại.
4. Redis lỗi → rơi về Postgres, không 503; readiness vẫn báo Redis down.
5. Mọi ghi vào `auth_sessions` đi qua `SESSION_STORE` — điều kiện để không có write nào "quên" invalidate.

### 3.4 CSRF

Cookie được trình duyệt gửi tự động, kể cả từ trang lạ → `CsrfGuard` yêu cầu header `X-Requested-With: XMLHttpRequest` trên mọi method không an toàn (kể cả route public như login). Trình duyệt không cho origin lạ gắn custom header nếu không qua CORS preflight, nên với SPA gọi API thế là đủ; kết hợp `SameSite=Lax` và CORS chỉ allow origin frontend.

## 4. Vì sao tách bạch và tách bằng cách nào

Controller và guard **không có `if (mode)`**. Chúng phụ thuộc ba port trung lập; `AuthModule` là nơi duy nhất biết cả hai mode và chọn implementation theo `AUTH_MODE`:

| Port | Trách nhiệm | `jwt` | `session` |
|---|---|---|---|
| `AUTHENTICATION_PORT` | credential → `AuthPrincipal` | `jwt-authentication.adapter.ts` | `session/session-authentication.adapter.ts` |
| `AUTH_STRATEGY` | signIn / renew / signOut / revokeAll | `jwt-auth.strategy.ts` | `session/session-auth.strategy.ts` |
| `AUTH_HTTP_TRANSPORT` | credential ở header/cookie nào, ghi/xoá cookie, body | `jwt-http.transport.ts` | `session/session-http.transport.ts` |

Guard hỏi transport "credential ở đâu?", đưa cho adapter "có hợp lệ không?", nhận về `AuthPrincipal`. Phần còn lại của hệ thống (`PermissionsGuard`, `@CurrentUser()`, audit) chỉ thấy `AuthPrincipal` và không biết mode nào đang chạy.

Quy ước tên biến: khái niệm có ở cả hai mode mang tiền tố `JWT_` / `SESSION_` (`JWT_REFRESH_COOKIE_NAME` vs `SESSION_COOKIE_NAME`); biến dùng chung không tiền tố (`AUTH_MODE`, `AUTH_LOCK_TIMEOUT_MS`, `PERMISSION_CACHE_TTL_MS`).

## 5. Phân quyền — chung cho cả hai mode

Sau khi có `AuthPrincipal`, `PermissionsGuard` chỉ cần `subjectId`. Permission là data `resource:action` trong DB; tập permission của user cache ở `rbac:perms:{userId}` (TTL 5 phút, fail-open về DB). Admin đổi role/permission qua `PUT /rbac/…` → commit → `DEL` cache tương ứng. Chi tiết và sơ đồ: [rbac.md](rbac.md).

## 6. Chọn mode nào

- Cần scale ngang nhiều instance, chấp nhận cửa sổ 15 phút sau logout, client là SPA/mobile giữ token trong memory → `jwt`.
- Cần revoke tức thì (khoá tài khoản, đổi mật khẩu, "đăng xuất mọi thiết bị" có hiệu lực ngay), chấp nhận Redis trên hot path và CSRF policy → `session`.

Đổi mode là đổi một biến env và deploy lại; client phải đổi cách gửi credential (Bearer header ↔ cookie + `X-Requested-With`). Không có giai đoạn chạy song song hai mode.

## 7. Bản đồ file

```
src/common/auth/
  authentication.port.ts        AUTHENTICATION_PORT
  auth-strategy.port.ts         AUTH_STRATEGY (AuthStrategy của @meago/core)
  auth-http-transport.port.ts   AUTH_HTTP_TRANSPORT
  session-store.port.ts         SESSION_STORE (SessionStore của @meago/core)
src/common/guards/
  csrf.guard.ts · authentication.guard.ts · permissions.guard.ts   (thứ tự chạy)
src/modules/auth/
  auth.module.ts                composition root — nơi duy nhất biết cả hai mode
  auth.controller.ts            không biết mode
  auth.service.ts               register + authenticateCredentials (chung) + JWT issue/refresh/logout
  jwt-authentication.adapter.ts · jwt-auth.strategy.ts · jwt-http.transport.ts
  refresh-session.entity.ts     bảng refresh_sessions
  session/
    session-authentication.adapter.ts · session-auth.strategy.ts · session-http.transport.ts
    auth-session.entity.ts      bảng auth_sessions
    postgres-session.store.ts   nguồn sự thật
    cached-session.store.ts     read-through cache Redis
    session-id.ts               generate / hash / isSessionLive / nextIdleExpiry
```

Sơ đồ chỉnh sửa được trong `docs/diagrams/backend-architecture.drawio`: page `Auth · Overview` (ma trận 4 luồng × 2 mode) rồi các page chi tiết `Auth · Login`, `Auth · Request verification`, `Auth · Refresh & revoke`, `Auth · Authorization (RBAC)`.
