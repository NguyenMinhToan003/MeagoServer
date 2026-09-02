import { sanitizeAuditMetadata } from './audit-sanitizer';

describe('sanitizeAuditMetadata', () => {
  it('redacts sensitive keys and removes log-injection line breaks', () => {
    expect(
      sanitizeAuditMetadata({
        changedFields: ['displayName'],
        note: 'first\r\nsecond',
        nested: { accessToken: 'secret-token', safe: true },
      }),
    ).toEqual({
      changedFields: ['displayName'],
      note: 'first  second',
      nested: { accessToken: '[REDACTED]', safe: true },
    });
  });

  it('bounds nested metadata depth', () => {
    const result = sanitizeAuditMetadata({ a: { b: { c: { d: { e: { f: 'value' } } } } } });
    expect(result).toEqual({ a: { b: { c: { d: { e: { truncated: true } } } } } });
  });
});
