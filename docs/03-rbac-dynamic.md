# Thiết kế RBAC động (permission-based)

> Trạng thái: THIẾT KẾ ĐÃ CHỐT — sẽ code trong phần nền móng.
> Không có teams/phòng ban/leader theo yêu cầu dự án.

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

## Cơ chế
- Decorator `@RequirePermissions('story:create')` dùng `SetMetadata`.
- `PermissionsGuard` chạy sau `JwtAuthGuard`: đọc metadata qua `Reflector`, load tập permission của user, so khớp.
- **Cache** tập permission theo `user_id` (in-memory TTL 5–15 phút ban đầu, Redis khi scale), invalidate khi admin sửa role/permission.
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
