# Đồng bộ contract Server - Client

## Nguồn sự thật

`C:\Meago\MeagoLibrary` phát hành package `@meago/core`. Hai repo Server và Client phải phụ thuộc một phiên bản package rõ ràng; không copy lại interface tương đương trong từng repo.

Contract được chia thành:

- Transport: response envelope, error, pagination, DTO auth.
- Identity: current user, auth principal, session/token response.
- Stable constants: API path và permission name thực sự dùng chung.
- Runtime primitives: result, typed error, pagination normalization.

Entity database không phải API contract. Không export TypeORM entity từ library.

## Quy tắc thay đổi

- Patch: sửa implementation, không đổi public type/behavior.
- Minor: thêm export hoặc field optional tương thích ngược.
- Major: xóa/đổi tên export, đổi field required hoặc đổi semantics.
- Không import từ `@meago/core/dist/...`; chỉ import public export hoặc documented subpath.
- Mọi export mới phải có TSDoc và được thêm vào public API document.

## Luồng phát hành

1. Thay đổi library và cập nhật changelog.
2. Chạy `npm run verify`.
3. Tăng version theo semver.
4. Publish package.
5. Nâng cùng version ở Server và Client.
6. Chạy type-check, integration test và contract test của cả hai repo.

OpenAPI vẫn là nguồn mô tả endpoint HTTP. Có thể generate client từ OpenAPI, nhưng các primitive ổn định và domain contract dùng chung vẫn thuộc `@meago/core`.

