const SECRET_KEY_PATTERN = /password|passwd|secret|token|api[_-]?key|otp|private[_-]?key|x[_-]?api[_-]?key/i;
const SECRET_VALUE_IN_TEXT = /\b(password|passwd|secret|token|api[_-]?key|otp|private[_-]?key|x[_-]?api[_-]?key)\b([\s:=]*)("[^"]*"|'[^']*'|\S+)/gi;
const REDACTED = "[REDACTED]";
const MAX_DEPTH = 10;
export function redactErrorString(value) {
    return value.replace(SECRET_VALUE_IN_TEXT, (_match, label, sep, val) => {
        const sepOut = sep.length > 0 ? sep : " ";
        if (val.length >= 2) {
            const first = val[0];
            const last = val[val.length - 1];
            if ((first === '"' || first === "'") && first === last) {
                return `${label}${sepOut}${first}${REDACTED}${last}`;
            }
        }
        return `${label}${sepOut}${REDACTED}`;
    });
}
export function redactSecrets(value, depth = 0) {
    if (depth > MAX_DEPTH)
        return value;
    if (value === null || value === undefined)
        return value;
    if (typeof value !== "object")
        return value;
    if (Array.isArray(value)) {
        return value.map((v) => redactSecrets(v, depth + 1));
    }
    const obj = value;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (SECRET_KEY_PATTERN.test(k)) {
            if (typeof v === "string" && v.length > 0) {
                out[k] = REDACTED;
            }
            else if (Array.isArray(v) || (v && typeof v === "object")) {
                out[k] = redactSecrets(v, depth + 1);
            }
            else {
                out[k] = v;
            }
        }
        else {
            out[k] = redactSecrets(v, depth + 1);
        }
    }
    return out;
}
