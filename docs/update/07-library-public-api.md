# `@meago/core` public API

## Contract

- Response: `IBaseResponse`, `IErrorResponse`, `IPaginatedResult`.
- Query/model: `IBaseQuery`, `IBaseModel`, `ITrackingModel`.
- Auth DTO: `ILoginDto`, `IRegisterDto`, `ITokenResponse`, `IJwtPayload`.
- Identity: `AuthPrincipal`, `AuthIdentity`, `AuthContext`, `AuthCredential`, `AuthResult`.
- Strategy: `AuthStrategy`, `AuthMode`, `SessionRecord`, `SessionStore`.

## Runtime primitive

- API: `joinApiPath`, `createSuccessResponse`, `createErrorResponse`.
- Error: `CoreError`, `CoreErrorCode`, `isCoreError`.
- Result: `Result`, `ok`, `err`, `isOk`, `isErr`, `unwrapResult`.
- Pagination: `normalizePagination`, `getPaginationOffset`, `createPaginatedResult`.
- Permission: `hasAllPermissions`, `hasAnyPermission`.
- Ports: `Clock`, `IdGenerator`, `Hasher`, `TransactionRunner`.

Runtime primitive phải deterministic, không đọc env và không giữ global state. Adapter/project chịu trách nhiệm cung cấp clock, ID, crypto, persistence và transport.

