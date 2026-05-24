const SECRET_KEY_PATTERN = /password|passwd|secret|token|api[_-]?key|otp|private[_-]?key|x[_-]?api[_-]?key/i;
const REDACTED = "[REDACTED]";
const MAX_DEPTH = 10;

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return value;
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, depth + 1));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      if (typeof v === "string" && v.length > 0) {
        out[k] = REDACTED;
      } else if (Array.isArray(v) || (v && typeof v === "object")) {
        out[k] = redactSecrets(v, depth + 1);
      } else {
        out[k] = v;
      }
    } else {
      out[k] = redactSecrets(v, depth + 1);
    }
  }
  return out;
}
