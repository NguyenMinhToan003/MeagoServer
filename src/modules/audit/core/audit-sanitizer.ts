const SENSITIVE_KEY = /password|secret|token|authorization|cookie|credential|api[-_]?key/i;
const MAX_DEPTH = 5;
const MAX_KEYS = 50;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 1_000;

/** Defense in depth; callers must still provide an explicit metadata allowlist. */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input) return null;
  return sanitizeObject(input, 0);
}

function sanitizeObject(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  if (depth >= MAX_DEPTH) return { truncated: true };
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, MAX_KEYS)
      .map(([key, value]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeValue(value, depth + 1),
      ]),
  );
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.replace(/[\r\n]/g, ' ').slice(0, MAX_STRING_LENGTH);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth));
  if (typeof value === 'object') return sanitizeObject(value as Record<string, unknown>, depth);
  if (typeof value === 'bigint') return value.toString();
  return '[UNSUPPORTED]';
}
