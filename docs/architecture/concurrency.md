# Transaction và concurrency control

Meago dùng ba chiến lược riêng biệt; không thay thế lẫn nhau:

| Tình huống | Chiến lược |
|---|---|
| Form/CRUD ít xung đột | Optimistic compare-and-swap bằng `version` |
| Read-decide-write bắt buộc tuần tự | Transaction + `SELECT ... FOR UPDATE` |
| Counter hoặc state change diễn đạt được trong một lệnh | Atomic SQL update |

Foundation nằm tại `src/database/concurrency.ts`; `BaseService` cung cấp API thuận tiện cho entity chuẩn có `id/version`.

## Transaction boundary

Transaction phải đặt ở application service điều phối use case. Mọi repository/service con phải nhận cùng `EntityManager`:

```ts
return this.runInTransaction(
  async (manager) => {
    const entity = await this.findOneByIdForUpdate(id, manager);
    // validate state, gọi các service khác với cùng manager, rồi save
    return manager.getRepository(MyEntity).save(entity);
  },
  { isolationLevel: 'READ COMMITTED', lockTimeoutMs: 3_000 },
);
```

`lockTimeoutMs` dùng PostgreSQL transaction-local setting, tránh request chờ lock vô hạn. Không giữ transaction trong lúc gọi HTTP bên ngoài, upload object hoặc xử lý CPU lâu.

## Optimistic lock

Entity kế thừa `BaseEntity` có `version`. Update DTO kế thừa `VersionedUpdateDto`, client phải gửi version đã đọc:

```ts
class UpdateStoryDto extends VersionedUpdateDto {
  @IsOptional()
  @IsString()
  title?: string;
}

return storyService.update(id, dto);
```

`BaseService.update()` thực thi một compare-and-swap nguyên tử:

```sql
UPDATE entity
SET ..., version = version + 1
WHERE id = :id AND version = :expectedVersion;
```

Nếu `affected = 0`, API trả `409` với code `OPTIMISTIC_LOCK_CONFLICT`. Client phải refetch và cho người dùng quyết định; không tự retry bằng version mới. `id`, timestamps và version trong payload không được phép ghi trực tiếp.

## Pessimistic lock

`findOneByIdForUpdate()` tương đương `FOR UPDATE` và bắt buộc nhận manager của transaction active. Có ba behavior:

- `wait`: chờ row được nhả lock; nên kết hợp lock timeout.
- `nowait`: fail ngay nếu row đang bị lock.
- `skip_locked`: bỏ qua row bị lock, phù hợp worker/job queue hơn CRUD theo id.

Refresh rotation hiện dùng transaction + `pessimistic_write`, vì token chỉ được consume đúng một lần. Đây là lựa chọn phù hợp hơn optimistic lock.

Khi invariant trải trên nhiều row không có aggregate row tự nhiên, `acquireTransactionAdvisoryLock()` cung cấp PostgreSQL transaction advisory lock. Mọi caller cùng invariant phải dùng cùng namespace/key và cùng lock order. Auth dùng `user -> family -> session row`; advisory lock tự được nhả khi commit/rollback.

## Nguyên tắc an toàn

- Không dùng `repository.update()` cho user-driven CRUD cần chống lost update.
- Chỉ khai báo `@VersionColumn` là chưa đủ; update phải có điều kiện `WHERE version = expected`.
- `FOR UPDATE` ngoài transaction hoặc dùng repository/manager khác sau khi lock là sai.
- Truy cập row theo cùng thứ tự trong mọi flow để giảm deadlock.
- Unique constraint vẫn là lớp bảo vệ cuối cho invariant uniqueness.
- Khi timeout/deadlock có retry, chỉ retry toàn bộ transaction idempotent với số lần giới hạn và jitter; không retry tùy tiện trong generic foundation.

Nguồn chuẩn: [PostgreSQL explicit/advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html), [TypeORM transactions](https://typeorm.io/docs/transactions/), [TypeORM QueryBuilder locking](https://typeorm.io/docs/query-builder/select-query-builder/).
