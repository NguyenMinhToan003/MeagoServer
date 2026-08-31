# Meago Foundation - quyết định kiến trúc

Thư mục này là nguồn quyết định kỹ thuật hiện hành cho Meago Foundation. Khi tài liệu cũ trong `docs/` khác với nội dung tại đây, tài liệu trong `docs/update/` được ưu tiên.

## Mục tiêu

- Xây dựng core trung lập, không gắn với riêng audio, automation hay một domain nghiệp vụ.
- Dùng chung contract giữa Server và Client qua package `@meago/core` trong `C:\Meago\MeagoLibrary`.
- Cho phép từng dự án chọn JWT + refresh rotation hoặc stateful session.
- Giữ application/domain độc lập với NestJS, Express, TypeORM, Redis và React.
- Ưu tiên code nhỏ, rõ ràng, composition thay vì base class lớn.

## Thứ tự triển khai

1. Chốt contract và boundary trong tài liệu.
2. Phát hành `@meago/core` theo semantic versioning.
3. Sửa refresh rotation và bổ sung test cạnh tranh.
4. Tách authentication port khỏi `JwtAuthGuard`.
5. Thêm JWT adapter và session adapter.
6. Đồng bộ Server/Client sang cùng phiên bản contract.

## Danh mục

- `01-core-boundaries.md`: phạm vi và dependency rule.
- `02-authentication.md`: JWT/session song song.
- `03-contract-sync.md`: đồng bộ interface và API.
- `04-refresh-token.md`: thuật toán rotation an toàn.
- `05-migration-plan.md`: lộ trình thay core cũ.
- `06-quality-gates.md`: tiêu chuẩn build, test và release.
- `07-library-public-api.md`: API công khai của `@meago/core`.

