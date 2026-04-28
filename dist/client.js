import { LruCache, resourceFromPath, ttlForResource } from "./cache.js";
const REGION_HOSTS = {
    us: "https://api.itglue.com",
    eu: "https://api.eu.itglue.com",
    au: "https://api.au.itglue.com",
};
const DEFAULT_MIN_INTERVAL_MS = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
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
    minIntervalMs;
    maxRetries;
    baseBackoffMs;
    cacheEnabled;
    cache;
    queueTail = Promise.resolve();
    lastSentAt = 0;
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
        this.minIntervalMs = config.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
        this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.baseBackoffMs = config.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
        this.cacheEnabled = config.cacheEnabled ?? true;
        this.cache = new LruCache(config.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES);
    }
    enqueueFetch(url, init) {
        const prev = this.queueTail;
        const run = (async () => {
            await prev.catch(() => { });
            const wait = Math.max(0, this.lastSentAt + this.minIntervalMs - Date.now());
            if (wait > 0)
                await sleep(wait);
            this.lastSentAt = Date.now();
            return fetch(url, init);
        })();
        this.queueTail = run.catch(() => { });
        return run;
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
        const resource = resourceFromPath(path);
        const cacheKey = method === "GET" ? `GET ${url}` : null;
        if (cacheKey && this.cacheEnabled) {
            const hit = this.cache.get(cacheKey);
            if (hit !== undefined)
                return hit;
        }
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
        let attempt = 0;
        for (;;) {
            const response = await this.enqueueFetch(url, { method, headers, body });
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
            if (response.ok) {
                if (cacheKey && this.cacheEnabled) {
                    const ttl = ttlForResource(resource);
                    if (ttl > 0)
                        this.cache.set(cacheKey, parsed, ttl);
                }
                else if (method !== "GET" && this.cacheEnabled && resource) {
                    const segment = `/${resource}`;
                    this.cache.invalidateMatching((key) => key.includes(segment));
                }
                return parsed;
            }
            if (attempt < this.maxRetries && RETRYABLE_STATUSES.has(response.status)) {
                const delay = computeBackoff(response, attempt, this.baseBackoffMs);
                await sleep(delay);
                attempt++;
                continue;
            }
            const message = extractErrorMessage(parsed, response.status, response.statusText);
            throw new ITGlueApiError(message, response.status, parsed);
        }
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
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function computeBackoff(response, attempt, base) {
    const ra = response.headers.get("retry-after");
    if (ra) {
        const seconds = Number(ra);
        if (Number.isFinite(seconds) && seconds > 0)
            return seconds * 1000;
        const dateMs = Date.parse(ra);
        if (Number.isFinite(dateMs)) {
            const diff = dateMs - Date.now();
            if (diff > 0)
                return diff;
        }
    }
    return base * Math.pow(2, attempt);
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
