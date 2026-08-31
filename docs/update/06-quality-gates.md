# Quality gates

Một phiên bản foundation chỉ được phát hành khi đạt các gate sau:

## Library

- TypeScript strict pass.
- Build ESM và CJS pass.
- Public declaration được sinh thành công.
- Không có runtime dependency ngoài danh sách đã duyệt.
- Package tarball chỉ chứa artifact cần phát hành.

## Server

- Unit test cho pure/application logic.
- Integration test PostgreSQL/Redis bằng môi trường cô lập.
- Auth concurrency test.
- Migration up/down test trên schema trống và schema phiên bản trước.
- Không dùng `synchronize=true` ở production.

## Client

- Type-check và production build pass.
- E2E login, reload, multi-tab, logout và expired credential.
- Không persist access/refresh token vào localStorage hoặc sessionStorage.

## Security

- Không log password, raw token, cookie hoặc secret.
- Rate limit login/OTP/refresh.
- JWT verify issuer/audience/algorithm.
- Session fixation và CSRF test.
- Dependency/security scan trong CI.

## Release

- Semver và changelog.
- Server/Client compatibility matrix.
- Rollback/migration note cho breaking release.

