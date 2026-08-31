# Refresh token rotation an toàn

## Invariant

- Một refresh token chỉ được consume thành công đúng một lần.
- Một token family chỉ có một successor hợp lệ tại một thời điểm.
- Expiry của family là absolute, rotation không kéo dài vô hạn.
- Reuse thực sự revoke toàn family.
- Race hợp lệ giữa tab/request không được tùy tiện kết luận là đánh cắp token.

## Transaction bắt buộc

Trong một DB transaction:

1. Hash raw token.
2. Lock row bằng `SELECT ... FOR UPDATE`, hoặc atomic conditional update.
3. Kiểm tra expiry, revoke và account status.
4. Tạo successor cùng `familyId`.
5. Đánh dấu row cũ `revokedAt`, `consumedAt`, `replacedBy`.
6. Commit rồi mới trả credential/cookie mới.

Nếu conditional update có `affected !== 1`, request đã thua race và phải đi qua reuse/race policy; tuyệt đối không tạo thêm successor.

## Cross-tab policy

Client web phối hợp refresh qua Web Locks hoặc `BroadcastChannel`. Backend có thể hỗ trợ grace window rất ngắn và replay successor idempotently, nhưng không lưu raw successor token. Nếu không triển khai replay an toàn, request thua race trả mã lỗi riêng để tab đồng bộ lại thay vì revoke family ngay.

## Test bắt buộc

- Hai refresh đồng thời chỉ tạo một successor.
- Reuse token cũ sau grace window revoke family.
- Token hết hạn không tạo row mới.
- Account bị block/password changed không renew được.
- Logout current và logout-all hoạt động đúng.
- Cleanup không xóa session còn hoạt động.

