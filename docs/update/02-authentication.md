# Authentication: JWT và stateful session

## Contract chung

Application chỉ biết `AuthStrategy`, `AuthPrincipal` và `AuthContext`. Guard/controller không được mang tên JWT.

```ts
interface AuthStrategy {
  signIn(identity: AuthIdentity, context: AuthContext): Promise<AuthResult>;
  authenticate(credential: AuthCredential, context: AuthContext): Promise<AuthPrincipal | null>;
  renew(credential: AuthCredential, context: AuthContext): Promise<AuthResult>;
  signOut(credential: AuthCredential, context: AuthContext): Promise<void>;
  revokeAll(subjectId: string): Promise<void>;
}
```

DI chọn implementation theo `AUTH_MODE=jwt|session`. Không rải câu lệnh kiểm tra mode trong controller hoặc service nghiệp vụ.

## JWT mode

- Access JWT ngắn hạn, mặc định 15 phút.
- Refresh token là opaque random token tối thiểu 256-bit.
- Chỉ lưu hash của refresh token.
- JWT phải có `sub`, `sid`, `jti`, `iss`, `aud`, `iat`, `exp`.
- Verify bằng algorithm allowlist, issuer và audience cố định.
- Rotation phải atomic theo tài liệu `04-refresh-token.md`.
- Access token của browser chỉ nằm trong memory; refresh token nằm trong cookie HttpOnly.

JWT mode phù hợp mobile/desktop/API hoặc hệ thống có nhiều service cần verify access token cục bộ.

## Session mode

- Browser nhận opaque session ID trong cookie HttpOnly.
- Server lookup session qua `SessionStore`, ưu tiên Redis; DB dùng cho audit/fallback nếu dự án cần.
- Có cả idle timeout và absolute timeout.
- Rotate session ID sau login, đổi quyền, đổi mật khẩu và privilege elevation.
- Logout xóa/revoke session server-side ngay lập tức.
- Request thay đổi state phải có CSRF/Origin protection phù hợp cookie policy.

Session mode là lựa chọn mặc định khuyến nghị cho web same-origin hoặc BFF vì đơn giản hóa client và revoke tức thời.

## Cookie policy

Cookie attributes đến từ typed config, không hard-code trong controller:

- `HttpOnly=true`.
- `Secure=true` ở production.
- Ưu tiên host-only cookie, không đặt `Domain` nếu không thật sự cần chia subdomain.
- `SameSite=Lax` cho same-site; nếu buộc dùng `None` phải có `Secure` và CSRF protection.
- Path nhỏ nhất phù hợp với credential.
- Clear cookie phải dùng cùng name/path/domain/sameSite/secure như lúc set.

## Authorization

Authentication chỉ tạo `AuthPrincipal`. RBAC đọc principal và permission store độc lập với JWT/session. Không nhét toàn bộ permission vào JWT.

