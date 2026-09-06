# Quy tắc coding backend

Trạng thái: **Accepted**. Đây là chuẩn bắt buộc cho code mới và phần code được sửa trong MeagoServer. Không mass-refactor code ngoài phạm vi chỉ để đồng nhất hình thức; khi chạm vào một boundary, phải đưa boundary đó về đúng chuẩn và bổ sung test phù hợp.

## 1. Kiến trúc và dependency

Luồng phụ thuộc chuẩn:

```text
controller / guard -> application service -> domain / port <- infrastructure adapter
```

- Controller chỉ xử lý HTTP mapping, DTO, principal và status code; không chứa business rule hoặc query TypeORM.
- Application service điều phối use case và transaction; không phụ thuộc request/response của Express.
- Domain/shared primitive không import NestJS, TypeORM, Redis, Axios hoặc implementation framework.
- Infrastructure adapter implement port; lựa chọn JWT/session, storage, mail hay cache nằm tại composition root.
- Không tạo `utils`, `helpers`, `common` như nơi chứa code không xác định trách nhiệm. Tên module/file phải phản ánh capability.
- Không tạo abstraction “dùng chung” trước khi có policy ổn định hoặc ít nhất hai consumer thực tế.

Lỗi bị cấm:

- Controller gọi repository trực tiếp.
- Entity database được dùng làm API/shared contract.
- Import chéo module để truy cập implementation nội bộ.
- Circular dependency được che bằng `forwardRef` mà không phân tích lại boundary.
- Wrapper chỉ đổi tên API thư viện nhưng không tạo policy/test seam.

## 2. TypeScript và API contract

- Bật strict typing; không dùng `any`, non-null assertion hoặc type cast để che lỗi thiết kế nếu có thể narrow/validate.
- Input ngoài trust boundary phải được validate trước khi vào use case.
- DTO HTTP không thay thế domain type; contract dùng chung FE/BE lấy từ exact version của `@meago/core`.
- Public response không trả entity nguyên bản; map rõ field được phép lộ.
- Enum/status/error code dùng giá trị ổn định, không dùng message hiển thị làm machine contract.
- Hàm async phải trả kiểu rõ ràng ở public/service boundary; không bỏ qua Promise bằng `void` trừ fire-and-forget đã có logging/error policy.
- Tên boolean bắt đầu bằng `is`, `has`, `can`, `should`; tên command/use case thể hiện hành động.

Lỗi bị cấm:

- `catch (error) {}` hoặc nuốt lỗi.
- `as unknown as ...` để ép contract không tương thích.
- Trả stack trace, SQL, token, secret hoặc internal exception cho client.
- Dùng string rải rác cho permission, injection token hoặc error code đã có constant/type.

## 3. Validation và lỗi

- Validation transport xử lý shape/format/size; business invariant thuộc application/domain.
- Chuẩn hóa input có chủ đích tại boundary, ví dụ email `trim().toLowerCase()`; không âm thầm biến đổi dữ liệu nhạy cảm như password.
- Error phải có HTTP status đúng, machine-readable code ổn định và message an toàn.
- Lỗi conflict/version/unique phải map rõ; lỗi concurrency có thể retry phải phân biệt với lỗi validation vĩnh viễn.
- Global filter chịu trách nhiệm format lỗi và redaction; service không tự dựng Express response.
- Không dùng exception để điều khiển luồng bình thường khi result type hoặc nhánh nghiệp vụ rõ ràng hơn.

## 4. Database, transaction và concurrency

- Production luôn `DB_SYNCHRONIZE=false`; schema change dùng migration mới, không sửa migration đã phát hành.
- Trong transaction chỉ dùng `EntityManager` được callback cung cấp; không dùng global repository/DataSource cho thao tác thuộc transaction.
- Transaction phải ngắn; không gọi HTTP, gửi email, upload file hoặc làm CPU work dài khi đang giữ database lock.
- CRUD do người dùng sửa dùng optimistic compare-and-swap với `version`.
- Read-decide-write quan trọng dùng transaction và lock theo [concurrency.md](../architecture/concurrency.md).
- Query/list/pagination/index tuân thủ [database-query-rules.md](database-query-rules.md).
- Thứ tự acquire nhiều lock phải cố định và được ghi lại; deadlock/serialization failure chỉ retry ở boundary có idempotency và giới hạn.
- Side effect cần nhất quán với commit phải dùng outbox/job phù hợp; không giả định gọi dịch vụ ngoài rồi rollback database có thể hoàn tác side effect.

Lỗi bị cấm:

- Read rồi update tách rời khi invariant phụ thuộc giá trị vừa đọc.
- Dùng `save()` như optimistic lock nhưng không có điều kiện `WHERE id AND version`.
- N+1 query trong list endpoint.
- Sort/filter field tùy ý từ request đi thẳng vào query builder.
- Transaction lồng nhau hoặc retry vô hạn mà không có policy rõ.

## 5. Authentication, authorization và security

- Endpoint mặc định được bảo vệ; public phải opt-in bằng `@Public()`.
- Authentication chạy trước authorization; use case nhận `AuthPrincipal`, không tự parse JWT/cookie.
- Password chỉ qua `PASSWORD_HASHER`; không log hoặc trả password hash.
- Refresh token rotation, revoke family và lock order tuân thủ tài liệu authentication.
- Chỉ một `AUTH_MODE` cho mỗi deployment. Controller/guard không có `if (mode)`: cấp/thu hồi credential qua `AUTH_STRATEGY`, header/cookie/body qua `AUTH_HTTP_TRANSPORT`; mỗi mode một bộ file riêng, `AuthModule` là nơi duy nhất biết cả hai. Không thêm code path chấp nhận cả Bearer lẫn session cookie.
- Mọi ghi vào `auth_sessions` đi qua `SESSION_STORE`; mọi ghi vào `user_roles`/`role_permissions` đi qua `RbacService` kèm invalidate. Không `repo.update/save` trực tiếp lên các bảng này ở nơi khác — đây là điều kiện để cache Redis đáng tin.
- Permission phải kiểm tra server-side; kiểm tra trên FE chỉ phục vụ UX.
- Secret đến từ environment/secret file và phải được validate khi boot.
- Query parameter binding, output encoding, request size limit, throttle và CORS được áp dụng tại đúng boundary; không tự nối SQL.
- Không log authorization header, cookie, access/refresh token, password, OTP hoặc secret.

## 6. Cache, logging và side effect

- Database là nguồn sự thật trừ khi capability ghi rõ khác; cache miss/failure không được làm sai dữ liệu chính.
- Cache key phải có namespace/version và tenant/user scope phù hợp; write phải có invalidation policy.
- Cache-aside chuẩn: chỉ đường đọc được `SET` (luôn kèm TTL); đường ghi commit database trước rồi chỉ `DEL`, không `SET`. Không cache giá trị âm (revoked/không tồn tại) trừ khi capability ghi rõ.
- Log có cấu trúc, request ID và context; không log cùng một lỗi ở mọi layer gây trùng lặp.
- Không `console.log` trong runtime production code.
- Sentry/monitoring không được nhận PII/secret chưa redaction.
- Job/message handler phải idempotent hoặc có deduplication key khi có thể delivery lại.
- Route mutation/sensitive action phải khai báo action ổn định theo chuẩn audit; không dùng URL,
  controller method hoặc message hiển thị làm audit action.
- Interceptor audit không được dump body/entity. Business metadata phải allowlist; mutation cần audit
  atomic phải gọi `recordRequired` với cùng `EntityManager`.
- Không update/delete audit event qua application code. Retention là operation được phê duyệt.

## 7. Test và review

- Unit test business invariant và error mapping; integration test transaction/query/migration; E2E test HTTP contract quan trọng.
- Bug fix phải có regression test nếu có thể tái hiện tự động.
- Concurrency test phải kiểm tra race/failure, không chỉ happy path tuần tự.
- Không mock đến mức test chỉ xác nhận chính implementation vừa viết.
- Thời gian/random/UUID/external service cần injectable boundary khi ảnh hưởng determinism.
- Test không phụ thuộc thứ tự chạy và phải cleanup dữ liệu do chính nó tạo.

Checklist trước bàn giao:

- [ ] Dependency direction đúng; không leak framework/entity qua boundary.
- [ ] Input, output và lỗi đã validate/map/redact.
- [ ] Transaction, lock, version và index đúng với invariant.
- [ ] Auth/permission không chỉ dựa vào client.
- [ ] Test bao phủ happy path, invalid input, conflict và failure quan trọng.
- [ ] Docs/migration/env/example được cập nhật cùng code.
- [ ] Các gate trong [quality-gates.md](quality-gates.md) đạt.
