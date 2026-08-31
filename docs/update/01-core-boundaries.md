# Core boundaries

## Dependency rule

Dependency chỉ được hướng vào trong:

```text
Client/Nest controllers
        -> application use cases
        -> domain + @meago/core contracts
        <- infrastructure adapters (TypeORM, Redis, JWT, session)
```

`@meago/core` không được import NestJS, Express, TypeORM, Redis, React hoặc code của một dự án cụ thể. Core chỉ chứa:

- Contract truyền qua boundary.
- Primitive dùng chung như result, error, pagination, permission.
- Port/interface cho clock, ID, transaction và authentication.
- Hàm thuần, deterministic và có thể test độc lập.

## Những gì không đưa vào core

- Entity TypeORM và repository cụ thể.
- Decorator/controller/guard NestJS.
- React hook, Zustand store hoặc Axios instance.
- Logic audio, story, automation, social, team hay department.
- Biến môi trường và global singleton.
- Một `BaseService` chứa CRUD, permission, cache, filter và transaction cùng lúc.

## Quy tắc module

- Module nghiệp vụ chỉ giao tiếp qua public service/port, không import repository hoặc entity của module khác.
- Transaction được mở ở application use case, không ở controller và không ẩn trong decorator reflection.
- DTO transport không được truyền thẳng thành persistence payload.
- Mọi sort field phải dùng allowlist của resource.
- Domain error không phụ thuộc HTTP status; adapter HTTP chịu trách nhiệm ánh xạ.

## Package layout đề xuất

```text
@meago/core             # package hiện tại, thuần TypeScript
@meago/nest             # tương lai: guard/filter/interceptor/module adapter
@meago/typeorm          # tương lai: repository/transaction adapter
@meago/redis            # tương lai: session/cache adapter
@meago/web-auth         # tương lai: browser/BFF auth client
```

Không thêm các package phụ cho tới khi có ít nhất hai consumer thực tế; tránh abstraction dự đoán trước.

