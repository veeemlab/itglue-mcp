const REGION_HOSTS = {
    us: "https://api.itglue.com",
    eu: "https://api.eu.itglue.com",
    au: "https://api.au.itglue.com",
};
export class ITGlueApiError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.name = "ITGlueApiError";
        this.status = status;
        this.body = body;
    }
}
export class ITGlueClient {
    apiKey;
    baseUrl;
    userAgent;
    constructor(config) {
        if (!config.apiKey) {
            throw new Error("ITGLUE_API_KEY is required");
        }
        const region = (config.region || "us").toLowerCase();
        const host = config.baseUrl || REGION_HOSTS[region];
        if (!host) {
            throw new Error(`Unknown ITGLUE_REGION "${config.region}". Expected one of: us, eu, au`);
        }
        this.apiKey = config.apiKey;
        this.baseUrl = host.replace(/\/+$/, "");
        this.userAgent = config.userAgent || "itglue-mcp/0.1";
    }
    buildUrl(path, query) {
        const url = new URL(path.startsWith("/") ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value === undefined || value === null)
                    continue;
                if (Array.isArray(value)) {
                    url.searchParams.set(key, value.join(","));
                }
                else {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        return url.toString();
    }
    async request(method, path, opts = {}) {
        const url = this.buildUrl(path, opts.query);
        const headers = {
            "x-api-key": this.apiKey,
            Accept: "application/vnd.api+json",
            "User-Agent": this.userAgent,
        };
        let body;
        if (opts.body !== undefined) {
            headers["Content-Type"] = "application/vnd.api+json";
            body = JSON.stringify(opts.body);
        }
        const response = await fetch(url, { method, headers, body });
        const text = await response.text();
        let parsed = undefined;
        if (text.length > 0) {
            try {
                parsed = JSON.parse(text);
            }
            catch {
                parsed = text;
            }
        }
        if (!response.ok) {
            const message = extractErrorMessage(parsed, response.status, response.statusText);
            throw new ITGlueApiError(message, response.status, parsed);
        }
        return parsed;
    }
    get(path, query) {
        return this.request("GET", path, { query });
    }
    post(path, body, query) {
        return this.request("POST", path, { query, body });
    }
    patch(path, body, query) {
        return this.request("PATCH", path, { query, body });
    }
    delete(path, query) {
        return this.request("DELETE", path, { query });
    }
    get baseHost() {
        return this.baseUrl;
    }
}
function extractErrorMessage(body, status, statusText) {
    if (body && typeof body === "object" && "errors" in body) {
        const errs = body.errors;
        if (Array.isArray(errs) && errs.length > 0) {
            const parts = errs
                .map((e) => {
                const title = typeof e.title === "string" ? e.title : undefined;
                const detail = typeof e.detail === "string" ? e.detail : undefined;
                return [title, detail].filter(Boolean).join(": ");
            })
                .filter(Boolean);
            if (parts.length > 0) {
                return `IT Glue API error (${status}): ${parts.join(" | ")}`;
            }
        }
    }
    return `IT Glue API error (${status} ${statusText})`;
}
export function buildPagination(args = {}) {
    const q = {};
    if (args.pageSize !== undefined)
        q["page[size]"] = args.pageSize;
    if (args.pageNumber !== undefined)
        q["page[number]"] = args.pageNumber;
    return q;
}
export function buildFilters(filters) {
    if (!filters)
        return {};
    const q = {};
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === "")
            continue;
        q[`filter[${key}]`] = value;
    }
    return q;
}
export function mergeQuery(...parts) {
    const out = {};
    for (const p of parts) {
        if (!p)
            continue;
        for (const [k, v] of Object.entries(p)) {
            if (v === undefined)
                continue;
            out[k] = v;
        }
    }
    return out;
}
