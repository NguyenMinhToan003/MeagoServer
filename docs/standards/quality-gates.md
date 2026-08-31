# Quality gates

Foundation chỉ được merge/phát hành khi đạt các gate phù hợp:

## MeagoLibrary

```bash
npm run verify
```

Kiểm tra strict type, ESM/CJS/declaration build, smoke test và tarball contents.

## MeagoServer

```bash
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e
npm audit --audit-level=high
```

E2E cần PostgreSQL/Redis thật và migration baseline. Không dùng `npm audit fix` tự động trong gate.

## MeagoClient

```bash
npm run lint
npm run ts-check
npm run build
npm audit --audit-level=high
```

Feature tương tác phải bổ sung test keyboard/accessibility phù hợp. Contract change phải nâng cùng exact `@meago/core` version ở cả hai consumer.
