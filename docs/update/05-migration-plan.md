# Lộ trình thay core cũ

## Phase 1 - Contract và primitive

- Phát hành `@meago/core` với response, error, result, pagination, permission, auth contract và ports.
- Server/Client bỏ interface trùng lặp và import từ package.
- Chưa thay đổi behavior runtime.

## Phase 2 - Authentication boundary

- Đổi `IJwtUser` thành `AuthPrincipal`.
- Global guard phụ thuộc `AuthStrategy` token.
- Bọc implementation JWT hiện tại thành adapter.
- Sửa atomic refresh và thêm integration test.

## Phase 3 - Session strategy

- Implement Redis session store.
- Thêm CSRF/Origin guard cho cookie-authenticated mutation.
- Cấu hình `AUTH_MODE=session` cho dự án web phù hợp.
- Client session mode bỏ access-token store và interceptor refresh.

## Phase 4 - Framework adapters

- Chỉ trích xuất `@meago/nest`, `@meago/typeorm`, `@meago/redis` sau khi API đã ổn định qua ít nhất hai ứng dụng.
- Không port nguyên `AActionsModel`, `CoreRes` hoặc guard đa nhiệm từ Evo/Bodevops.

## Compatibility

Trong giai đoạn chuyển đổi, adapter có thể trả response envelope cũ. Không đổi đồng thời auth behavior, response shape và persistence schema trong một release.

