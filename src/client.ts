const REGION_HOSTS: Record<string, string> = {
  us: "https://api.itglue.com",
  eu: "https://api.eu.itglue.com",
  au: "https://api.au.itglue.com",
};

export interface ClientConfig {
  apiKey: string;
  region: string;
  baseUrl?: string;
  userAgent?: string;
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
    const response = await fetch(url, { method, headers, body });
    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!response.ok) {
      const message = extractErrorMessage(parsed, response.status, response.statusText);
      throw new ITGlueApiError(message, response.status, parsed);
    }
    return parsed as T;
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
