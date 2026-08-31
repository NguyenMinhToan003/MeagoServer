# Quy tắc truy vấn và phân trang cơ sở dữ liệu

Tài liệu này là chuẩn bắt buộc khi thêm hoặc sửa list query, `ORDER BY`, pagination hay database index trong MeagoServer. Migration là nguồn sự thật của index production.

## 1. Thứ tự phải xác định khi phân trang

Mọi truy vấn có pagination phải tạo ra **total order xác định**. Không có quy tắc “luôn cần hai cột UNIQUE”. Quy tắc đúng là toàn bộ biểu thức `ORDER BY` phải phân biệt được thứ tự của mọi hàng.

- Nếu cột sắp xếp đã unique, một cột là đủ: `ORDER BY id DESC`.
- Nếu cột sắp xếp không unique, phải thêm primary key hoặc unique key làm tie-breaker cuối cùng: `ORDER BY created_at DESC, id DESC`.
- Không phân trang chỉ bằng `ORDER BY created_at`, `priority` hoặc `name` vì các giá trị có thể trùng nhau.
- Không dựa vào thứ tự vật lý, execution plan hoặc thứ tự ngầm của primary key.
- Hướng và cách xử lý `NULL` là một phần của contract; cột cursor nên `NOT NULL` nếu nghiệp vụ cho phép.

Ví dụ mặc định:

```sql
SELECT *
FROM users
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

## 2. Cursor phải phản ánh toàn bộ ORDER BY

Cursor phải chứa đầy đủ các giá trị tham gia sắp xếp, cùng hướng so sánh với `ORDER BY`.

```sql
SELECT *
FROM users
WHERE (created_at, id) < (:created_at, :id)
ORDER BY created_at DESC, id DESC
LIMIT :limit;
```

- Cursor API phải được encode như một giá trị opaque; client không tự tạo hoặc thay đổi cursor.
- Không chỉ lưu `created_at` trong cursor nếu query dùng `(created_at, id)`.
- Không trộn offset và cursor trong cùng một contract.
- Offset pagination chỉ phù hợp với tập dữ liệu nhỏ hoặc màn hình cần nhảy tới số trang; offset lớn không phải lựa chọn mặc định cho feed/list tăng trưởng liên tục.
- Total order ngăn thứ tự đồng hạng bất định; nó không tự tạo snapshot. Dữ liệu được insert/update giữa hai request vẫn có thể thay đổi tập kết quả theo isolation và nghiệp vụ.

## 3. Index phải khớp query shape

Query nóng có `LIMIT` nên có B-tree index khớp với equality filter, thứ tự sort và tie-breaker.

Không filter:

```sql
CREATE INDEX IDX_users_created_at_id
ON users (created_at DESC, id DESC);
```

Theo tenant:

```sql
SELECT *
FROM orders
WHERE tenant_id = :tenant_id
ORDER BY created_at DESC, id DESC
LIMIT :limit;

CREATE INDEX IDX_orders_tenant_created_at_id
ON orders (tenant_id, created_at DESC, id DESC);
```

Convention thực tế thường là:

```text
equality filters -> range/sort columns -> unique tie-breaker
```

Đây là heuristic, không phải công thức thay thế đo đạc. Điều kiện range, join, partial index, mixed sort direction và distribution dữ liệu có thể cần index khác.

## 4. Không tạo index theo cảm tính

Mỗi index mới phải:

1. Gắn với query/use case cụ thể.
2. Được tạo bằng migration mới; không sửa migration đã phát hành.
3. Được kiểm tra trên dữ liệu có kích thước và phân bố gần production.
4. Có bằng chứng `EXPLAIN (ANALYZE, BUFFERS)` ở môi trường không phải production khi tối ưu query PostgreSQL.
5. Cân nhắc chi phí dung lượng và chi phí cập nhật index khi `INSERT`, `UPDATE`, `DELETE`.

Không ép planner dùng index chỉ để làm plan trông đơn giản. PostgreSQL có thể chọn sequential scan và sort khi đọc phần lớn bảng; lựa chọn đó có thể đúng.

## 5. Quy tắc implementation

- Field sort nhận từ API phải nằm trong allowlist; không đưa chuỗi tùy ý vào query builder.
- Sort contract phải khai báo tie-breaker ở backend, không yêu cầu client tự bổ sung `id`.
- QueryBuilder, repository và raw SQL phải dùng parameter binding.
- Nếu endpoint cho phép nhiều sort field, phải xác định rõ field nào hỗ trợ cursor và index nào phục vụ query phổ biến; không tạo mọi tổ hợp index.
- Composite index phải khớp cả thứ tự cột và hướng sort cần tối ưu. PostgreSQL có thể quét ngược toàn bộ B-tree, nhưng mixed direction như `a ASC, b DESC` cần index tương ứng nếu muốn tránh sort.
- MySQL/InnoDB cũng cần deterministic order và composite index phù hợp; không có ngoại lệ “MySQL không cần index”. Luôn xác nhận bằng execution plan của database đang dùng.

## 6. Checklist review

- [ ] Query phân trang có total order xác định.
- [ ] Primary/unique key là tie-breaker cuối nếu sort chính không unique.
- [ ] Cursor chứa đủ các thành phần của `ORDER BY`.
- [ ] Toán tử cursor và hướng sort khớp nhau.
- [ ] Sort field từ request đã qua allowlist.
- [ ] Index phục vụ query shape thực tế và được thêm bằng migration.
- [ ] Query nóng đã được kiểm tra bằng `EXPLAIN (ANALYZE, BUFFERS)`.
- [ ] Test có nhiều hàng trùng giá trị sort chính và kiểm tra không lặp/mất hàng giữa các page.

## Tham chiếu chính thức

- [PostgreSQL: Indexes and ORDER BY](https://www.postgresql.org/docs/current/indexes-ordering.html)
- [PostgreSQL: Multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
- [MySQL: LIMIT query optimization và deterministic ordering](https://dev.mysql.com/doc/refman/8.0/en/limit-optimization.html)
- [MySQL: Optimization and indexes](https://dev.mysql.com/doc/refman/8.4/en/optimization-indexes.html)
