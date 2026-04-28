const REGION_HOSTS: Record<string, string> = {
  us: "https://api.itglue.com",
  eu: "https://api.eu.itglue.com",
  au: "https://api.au.itglue.com",
};

const DEFAULT_MIN_INTERVAL_MS = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 1000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface ClientConfig {
  apiKey: string;
  region: string;
  baseUrl?: string;
  userAgent?: string;
  minIntervalMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
}

export interface JsonApiResource {
  type: string;
  id?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface JsonApiDocument<T = JsonApiResource | JsonApiResource[]> {
  data?: T;
  included?: JsonApiResource[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
  errors?: Array<Record<string, unknown>>;
}

export class ITGlueApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ITGlueApiError";
    this.status = status;
    this.body = body;
  }
}

export class ITGlueClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private queueTail: Promise<unknown> = Promise.resolve();
  private lastSentAt = 0;

  constructor(config: ClientConfig) {
    if (!config.apiKey) {
      throw new Error("ITGLUE_API_KEY is required");
    }
    const region = (config.region || "us").toLowerCase();
    const host = config.baseUrl || REGION_HOSTS[region];
    if (!host) {
      throw new Error(
        `Unknown ITGLUE_REGION "${config.region}". Expected one of: us, eu, au`,
      );
    }
    this.apiKey = config.apiKey;
    this.baseUrl = host.replace(/\/+$/, "");
    this.userAgent = config.userAgent || "itglue-mcp/0.1";
    this.minIntervalMs = config.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseBackoffMs = config.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  }

  private enqueueFetch(url: string, init: RequestInit): Promise<Response> {
    const prev = this.queueTail;
    const run = (async () => {
      await prev.catch(() => {});
      const wait = Math.max(0, this.lastSentAt + this.minIntervalMs - Date.now());
      if (wait > 0) await sleep(wait);
      this.lastSentAt = Date.now();
      return fetch(url, init);
    })();
    this.queueTail = run.catch(() => {});
    return run;
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(
      path.startsWith("/") ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`,
    );
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(","));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request<T = JsonApiDocument>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      Accept: "application/vnd.api+json",
      "User-Agent": this.userAgent,
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/vnd.api+json";
      body = JSON.stringify(opts.body);
    }
    let attempt = 0;
    for (;;) {
      const response = await this.enqueueFetch(url, { method, headers, body });
      const text = await response.text();
      let parsed: unknown = undefined;
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      if (response.ok) return parsed as T;
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

  get<T = JsonApiDocument>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T = JsonApiDocument>(path: string, body: unknown, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, { query, body });
  }

  patch<T = JsonApiDocument>(path: string, body: unknown, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("PATCH", path, { query, body });
  }

  delete<T = JsonApiDocument>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }

  get baseHost(): string {
    return this.baseUrl;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoff(response: Response, attempt: number, base: number): number {
  const ra = response.headers.get("retry-after");
  if (ra) {
    const seconds = Number(ra);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const dateMs = Date.parse(ra);
    if (Number.isFinite(dateMs)) {
      const diff = dateMs - Date.now();
      if (diff > 0) return diff;
    }
  }
  return base * Math.pow(2, attempt);
}

function extractErrorMessage(body: unknown, status: number, statusText: string): string {
  if (body && typeof body === "object" && "errors" in (body as Record<string, unknown>)) {
    const errs = (body as { errors?: Array<Record<string, unknown>> }).errors;
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

export function buildPagination(args: {
  pageSize?: number;
  pageNumber?: number;
} = {}): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (args.pageSize !== undefined) q["page[size]"] = args.pageSize;
  if (args.pageNumber !== undefined) q["page[number]"] = args.pageNumber;
  return q;
}

export function buildFilters(filters?: Record<string, unknown>): Record<string, unknown> {
  if (!filters) return {};
  const q: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    q[`filter[${key}]`] = value;
  }
  return q;
}

export function mergeQuery(
  ...parts: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined) continue;
      out[k] = v;
    }
  }
  return out;
}
