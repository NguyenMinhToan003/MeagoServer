# Audit trail

Trạng thái: **Implemented foundation**. Module audit ghi lịch sử hành động có thể quy trách nhiệm,
tách biệt với operational log của Pino và lỗi/trace của Sentry.

## Mục tiêu và boundary

Mỗi event trả lời được: khi nào, ai, thực hiện action nào, lên resource nào, trong request nào và
kết quả ra sao. Audit không phải bản sao request/response và không thay observability.

```text
Controller @AuditAction
        │ metadata
        ▼
AuditInterceptor ── requestId / actor / route / outcome / duration
        │ best effort
        ▼
AuditService ── sanitizer ── AuditEventEntity ── PostgreSQL

Application service ── recordRequired(event, EntityManager)
                             │
                             └── cùng transaction với mutation quan trọng
```

- Interceptor chỉ hoạt động trên handler/controller opt-in bằng `@AuditAction`.
- Interceptor không đọc request body, response body, cookie hoặc authorization header.
- Application service dùng `recordRequired` khi cần resource ID, changed fields hoặc tính atomic.
- JWT và session đều dùng được vì actor chỉ phụ thuộc `AuthPrincipal` gắn vào request.

## Cách áp dụng route

```ts
@Post()
@AuditAction({
  action: 'stories.create',
  resourceType: 'story',
  resourceIdPath: 'id',
})
create() {}
```

Action là machine identifier ổn định theo dạng `<domain>.<resource>.<verb>`; không dùng tên method,
message hiển thị hoặc URL làm action. `resourceIdPath` chỉ đọc dot-path từ kết quả thành công và
không lưu phần còn lại của response.

Nên audit route mutation, auth/session, admin, role/permission, export, upload/delete và sensitive
read. Không audit health check, static request hoặc GET công khai thông thường chỉ để thay access log.

## Audit trong transaction

```ts
await service.runInTransaction(async (manager) => {
  const story = await createStory(input, manager);
  await auditService.recordRequired(
    {
      action: 'stories.create',
      outcome: 'success',
      actorType: 'user',
      actorId: principal.subjectId,
      resourceType: 'story',
      resourceId: story.id,
      metadata: { changedFields: ['title', 'status'] },
    },
    manager,
  );
  return story;
});
```

`recordRequired` lỗi thì transaction rollback. `recordBestEffort` dành cho HTTP/security observation;
lỗi ghi audit được phát vào operational log nhưng không làm request chính thất bại. Không gọi
`recordBestEffort` cho record bắt buộc về compliance.

## Schema và tính bất biến

`audit_events` là append-only và không kế thừa `BaseEntity`: không có `updatedAt`, `version` hoặc API
update/delete. Trigger database chặn `UPDATE` và `DELETE`. Retention sau này phải chạy bằng migration/
operation được phê duyệt, tạm quản lý trigger một cách rõ ràng và ghi lại chính thao tác đó.

Các index hiện có phục vụ query thực tế:

- `(actorId, occurredAt DESC, id DESC)`
- `(resourceType, resourceId, occurredAt DESC, id DESC)`
- `(action, occurredAt DESC, id DESC)`
- `(requestId)`

List dùng total order `(occurredAt DESC, id DESC)` và cursor chứa đủ hai giá trị. Chưa tạo GIN cho
`metadata` và chưa partition vì chưa có query/volume production chứng minh nhu cầu.

## Dữ liệu và redaction

Không bao giờ ghi password/hash, token, cookie, authorization, OTP, secret, connection string, raw
request body hoặc raw response body. Metadata phải do use case allowlist trước; sanitizer chỉ là lớp
phòng thủ thứ hai, có redaction sensitive key, loại CR/LF và giới hạn depth/size.

Update mặc định chỉ lưu `changedFields`. Diff before/after chỉ được lưu cho field allowlist, không
reflection/dump toàn entity. IP/user-agent là dữ liệu vận hành có retention và quyền đọc hạn chế.

## API tra cứu và RBAC

```text
GET /api/v1/audit-events
GET /api/v1/audit-events/:id
```

Yêu cầu permission `audit.events.read`. List hỗ trợ actor, action, resource, outcome, khoảng thời gian,
limit và cursor. Việc đọc audit history cũng được audit. Response không có endpoint mutation.

## Action đang áp dụng

- `auth.register`
- `auth.login`
- `auth.refresh`
- `auth.logout`
- `auth.logout_all`
- `audit.events.list`
- `audit.events.read`

## Vận hành và mở rộng

- Migration `1700000002000-CreateAuditEvents` là nguồn schema production.
- Permission audit được bootstrap vào role administrator qua default system data.
- Khi scale write lớn, giữ nguyên AuditService contract và thay persistence bằng transactional outbox/
  queue adapter; không fire-and-forget event bắt buộc.
- Chỉ partition theo `occurredAt` sau khi có volume, retention và query-plan thực tế.
- Khi OpenTelemetry được triển khai, truyền trace ID hiện có để correlation; audit không trở thành trace.

Tham chiếu: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html),
[NestJS Interceptors](https://docs.nestjs.com/interceptors),
[PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).
