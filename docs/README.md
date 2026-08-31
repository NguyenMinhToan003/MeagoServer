# Tài liệu MeagoServer

Tài liệu được tổ chức theo mục đích:

| Nhóm | Nội dung |
|---|---|
| [architecture](architecture/) | Boundary, authentication, RBAC, upload và cấu trúc modular monolith |
| [operations](operations/) | Môi trường, Docker, logging, monitoring, security và vận hành |
| [standards](standards/) | Coding rules, database query rules và quality gate bắt buộc |
| [reference](reference/) | Technology stack và trách nhiệm của thư viện |
| [research](research/) | Hướng nghiên cứu chưa cam kết triển khai |
| [diagrams](diagrams/) | Nguồn sơ đồ `.drawio` có thể chỉnh sửa bằng diagrams.net |

Đọc theo thứ tự:

1. [Technology stack](reference/technology-stack.md)
2. [Core foundation](architecture/core-foundation.md)
3. [Cấu trúc hệ thống](architecture/system.md)
4. [Authentication](architecture/authentication.md)
5. [Transaction và concurrency](architecture/concurrency.md)
6. [Quy tắc coding backend](standards/coding-rules.md)
7. [Quy tắc truy vấn và phân trang](standards/database-query-rules.md)
8. [Quality gates](standards/quality-gates.md)

Dữ liệu mặc định và tài khoản quản trị: [System data bootstrap](operations/system-data.md).

Không dùng thư mục trạng thái theo phase làm nguồn sự thật. Khi implementation thay đổi, cập nhật trực tiếp tài liệu kiến trúc hoặc vận hành tương ứng trong cùng pull request.

AI phải đọc `C:\Meago\AGENTS.md`, sau đó `C:\Meago\MeagoServer\AGENTS.md` trước tài liệu repo này.
