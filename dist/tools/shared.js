export { formatOptionsSchema } from "../format.js";
export function textResult(payload) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    return {
        content: [{ type: "text", text }],
    };
}
export function errorResult(err) {
    const message = err instanceof Error ? err.message : String(err);
    const body = err && typeof err === "object" && "body" in err
        ? err.body
        : undefined;
    const payload = body
        ? { error: message, details: body }
        : { error: message };
    return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
}
export function paginationSchema() {
    return {
        pageSize: {
            type: "integer",
            description: "page[size] — items per page (default IT Glue: 50, max 1000 for most endpoints).",
            minimum: 1,
        },
        pageNumber: {
            type: "integer",
            description: "page[number] — 1-based page index.",
            minimum: 1,
        },
    };
}
export function pickPagination(args) {
    return {
        pageSize: toIntOrUndef(args.pageSize),
        pageNumber: toIntOrUndef(args.pageNumber),
    };
}
export function toIntOrUndef(v) {
    if (v === undefined || v === null || v === "")
        return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}
export function toStrOrUndef(v) {
    if (v === undefined || v === null)
        return undefined;
    const s = String(v);
    return s.length > 0 ? s : undefined;
}
export function requireString(args, key) {
    const v = args[key];
    if (v === undefined || v === null || v === "") {
        throw new Error(`Missing required argument: ${key}`);
    }
    return String(v);
}
export function requireId(args, key = "id") {
    return requireString(args, key);
}
