const SECRET_KEY = /password|token|secret|authorization|cookie|^pin$|pin_hash|pinHash/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(nested);
    }
    return output;
  }
  return value;
}
