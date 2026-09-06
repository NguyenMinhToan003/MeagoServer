# RBAC động (permission-based)

> Trạng thái: **Implemented** — guard, cache Redis, và endpoint quản trị role/permission.
> Không có teams/phòng ban/leader theo yêu cầu dự án.

## Endpoint quản trị (`/api/v1/rbac`)

| Method | Route | Permission | Audit action | Invalidate |
|---|---|---|---|---|
| GET | `/rbac/roles` | `role:read` | — | — |
| GET | `/rbac/permissions` | `role:read` | — | — |
| PUT | `/rbac/roles/:id/permissions` | `role:manage` | `rbac.role.set_permissions` | `invalidateAll()` — mọi user mang role |
| PUT | `/rbac/users/:id/roles` | `user:manage` | `rbac.user.set_roles` | `invalidateUser(id)` |

Body thay toàn bộ (`permissions: string[]` theo tên; `roleIds: uuid[]`). Permission/role không tồn tại → `400 RBAC_UNKNOWN_PERMISSION` / `RBAC_UNKNOWN_ROLE` kèm `details.missing`, không ghi gì. Row role/user được `FOR UPDATE` trong transaction; invalidate chạy **sau commit** (cache-aside: DB trước, DEL sau). Đây là điểm mutation duy nhất của `role_permissions`/`user_roles` qua HTTP — xem rule tại `coding-rules.md` §5.

## Nguyên tắc
Roles và permissions là **data trong DB**, admin tạo/sửa runtime. Code chỉ biết chuỗi permission dạng `resource:action` (vd `story:create`, `user:ban`), không hardcode enum role.

## Schema DB (5 bảng)
```
users(id, ...)
roles(id, name, description)
permissions(id, name)              -- "resource:action"
role_permissions(role_id, permission_id)
user_roles(user_id, role_id)
```

## Luồng hoạt động

### Kiểm tra quyền mỗi request (giống nhau ở cả hai `AUTH_MODE`)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant PG as PermissionsGuard
    participant Rf as Reflector
    participant S as RbacService
    participant R as Redis
    participant DB as PostgreSQL
    C->>PG: request (request.user đã có từ AuthenticationGuard)
    PG->>Rf: getAllAndOverride(@RequirePermissions) handler → class
    alt route không có decorator
        PG-->>C: pass — chỉ cần đã xác thực
    else route có decorator
        PG->>S: getUserPermissions(subjectId)
        S->>R: GET rbac:perms:{uid}
        alt miss / Redis lỗi
            S->>DB: users → user_roles → roles → role_permissions → permissions
            S->>R: SET rbac:perms:{uid} PX=PERMISSION_CACHE_TTL_MS (5m)
        end
        S-->>PG: Set<permission>
        PG->>PG: missing = required − granted (cần đủ TẤT CẢ)
        PG-->>C: pass → handler, hoặc 403 "Missing permissions: …"
    end
```

### Admin đổi quyền → invalidate sau commit

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Ctl as RbacController
    participant S as RbacService
    participant DB as PostgreSQL
    participant R as Redis
    A->>Ctl: PUT /rbac/roles/:id/permissions {permissions[]} (role:manage)
    Ctl->>S: setRolePermissions(roleId, names)
    S->>DB: BEGIN · SELECT role FOR UPDATE
    S->>DB: SELECT permissions WHERE name IN (…) — thiếu → 400 RBAC_UNKNOWN_PERMISSION
    S->>DB: save role_permissions · COMMIT
    S->>R: SAU COMMIT: SCAN + DEL rbac:perms:* (mọi user mang role)
    Ctl-->>A: IRole · audit rbac.role.set_permissions
    A->>Ctl: PUT /rbac/users/:id/roles {roleIds[]} (user:manage)
    Ctl->>S: setUserRoles(userId, roleIds)
    S->>DB: BEGIN · SELECT user FOR UPDATE · SELECT roles IN (…) · save user_roles · COMMIT
    S->>R: SAU COMMIT: DEL rbac:perms:{uid} (chỉ user đó)
    Ctl-->>A: {id, roles[]} · audit rbac.user.set_roles
    Note over S,R: Sửa DB bằng tay ngoài endpoint → chỉ TTL 5m bảo vệ
```

Sơ đồ chỉnh sửa được: page *Auth · Authorization (RBAC)* trong `docs/diagrams/backend-architecture.drawio`.

## Cơ chế
- Decorator `@RequirePermissions('story:create')` dùng `SetMetadata`.
- `PermissionsGuard` chạy sau `AuthenticationGuard`: đọc `AuthPrincipal` và metadata qua `Reflector`, load tập permission của user, rồi so khớp.
- **Cache** tập permission theo `user_id` trong Redis (`rbac:perms:{userId}`, TTL `PERMISSION_CACHE_TTL_MS` = 5 phút), fail-open về DB khi Redis lỗi; invalidate qua hai endpoint ở trên. Sửa DB bằng tay ngoài endpoint thì chỉ TTL bảo vệ.
- KHÔNG nhét toàn bộ permissions vào JWT payload (token phình + không revoke được khi đổi quyền giữa chừng).

## CASL vs custom guard — kết luận
| | Custom PermissionsGuard | CASL |
|---|---|---|
| Độ phức tạp | Thấp (~100 dòng) | Phải học ability/subject/conditions |
| Kiểu kiểm soát | resource:action phẳng | RBAC + ABAC (điều kiện thuộc tính) |
| Query-level filter | Tự viết | Có sẵn |

**Chọn: custom PermissionsGuard.** CASL chỉ đáng khi cần ownership/điều kiện phức tạp; ownership đơn giản ("bài của tôi") check bằng `if (entity.authorId !== user.id)` trong service là đủ. Permission string `resource:action` mở rộng dần không cần đổi schema.

## Nguồn tham khảo
- https://medium.com/@kathishcivil94/demystifying-access-control-rbac-vs-casl-in-nestjs-e1cde782e5c0
- https://medium.com/yavar/casl-roles-with-persisted-permissions-in-nestjs-152129f4a6fb
- https://dev.to/imzihad21/custom-role-based-access-control-in-nestjs-using-custom-guards-jol
- https://github.com/nrprosper/nest-casl-rbac
- https://dev.to/emann/abac-and-casl-with-nestjs-3d6c
