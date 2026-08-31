# Core foundation và đồng bộ contract

## Dependency rule

```text
HTTP/UI adapters
    -> application use cases
    -> domain + @meago/core contracts
    <- infrastructure adapters (TypeORM, Redis, JWT, session)
```

- `@meago/core` không import NestJS, Express, TypeORM, Redis, React hoặc code dự án cụ thể.
- Shared contract chỉ được định nghĩa tại `C:\Meago\MeagoLibrary` và phát hành bằng package `@meago/core`.
- Server và Client pin cùng exact version; không copy interface tương đương giữa repo.
- Database entity không phải API contract và không được export từ core.
- Framework adapter thuộc consumer; core chỉ chứa contract và primitive trung lập.

## Trạng thái hiện tại

- `@meago/core@0.2.0` đã được publish và pin ở cả Server/Client.
- Response, pagination, current user, API path và authentication principal đã chuyển sang nguồn contract chung.
- Global authentication dùng `AuthPrincipal` và transport-neutral `AuthenticationPort`.
- JWT hiện tại là adapter; thiết kế cho phép dự án khác chọn stateful session mà không đổi application principal.

## Quy tắc phát hành

1. Thay đổi package và chạy `npm run verify` tại MeagoLibrary.
2. Phân loại semver: patch không đổi contract; minor chỉ thêm tương thích; breaking change là major.
3. Publish package, nâng exact version đồng thời ở Server và Client.
4. Chạy lint/type/build/test/audit ở hai consumer.

Không đưa helper riêng Nest/React hoặc business rule audio vào library chỉ vì có thể dùng lại trong một repo.
