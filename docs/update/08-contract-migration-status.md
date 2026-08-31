# Contract migration status

## Phase 1 - hoàn thành với `@meago/core@0.2.0`

Ngày thực hiện: 2026-08-31.

MeagoServer và MeagoClient đang pin chính xác cùng phiên bản:

```json
"@meago/core": "0.2.0"
```

Đã chuyển sang nguồn contract chung:

- Response envelope và paginated result.
- Base query contract.
- Login/register DTO contract.
- Current-user contract.
- API version/controller/action constants.
- User-status enum.
- Permission constants dùng bởi database seed.

Đã xóa các file mirror trùng lặp ở từng consumer. DTO có decorator của NestJS vẫn nằm ở Server nhưng `implements` interface transport từ library.

## Verification

- MeagoLibrary `npm run verify`: pass.
- MeagoServer strict type-check: pass.
- MeagoServer production build: pass.
- MeagoClient strict type-check: pass.
- MeagoClient production build: pass.

## Phase tiếp theo

Phase 2 thay boundary authentication nhưng không đổi HTTP behavior ngay:

1. Đưa `AuthPrincipal` vào request/current-user decorator.
2. Tạo injection token cho authentication strategy.
3. Bọc JWT implementation hiện tại thành adapter.
4. Sửa refresh rotation thành transaction atomic và thêm concurrency test.
5. Sau khi JWT adapter ổn định mới thêm stateful-session adapter.

Không triển khai session song song trước khi refresh/JWT regression test đầy đủ, tránh hai implementation cùng mang lỗi chưa được khóa bằng test.

