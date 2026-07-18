const SENSITIVE_KEY_PATTERN =
  /(?:password|passphrase|secret|token|api[_-]?key|private[_-]?key|community|bindpw|credential|authorization)/i;

export interface RedactOptions {
  preservePresence?: boolean;
  additionalKeys?: string[];
}

/**
 * Deeply removes secret-bearing values before objects cross an API boundary.
 * Arrays and plain objects are copied; the input is never mutated.
 */
export function redactSecrets<T>(value: T, options: RedactOptions = {}): T {
  const additional = new Set((options.additionalKeys || []).map((key) => key.toLowerCase()));

  const walk = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(walk);
    if (!current || typeof current !== 'object' || current instanceof Date) return current;

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      const sensitive = SENSITIVE_KEY_PATTERN.test(key) || additional.has(key.toLowerCase());
      if (sensitive) {
        if (options.preservePresence) {
          const presenceKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          result[presenceKey] = nested !== undefined && nested !== null && nested !== '';
        }
        continue;
      }
      result[key] = walk(nested);
    }
    return result;
  };

  return walk(value) as T;
}

export function hasSecret(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}
