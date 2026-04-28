export class LruCache {
    max;
    map = new Map();
    constructor(max = 500) {
        this.max = Math.max(1, max);
    }
    get(key) {
        const entry = this.map.get(key);
        if (!entry)
            return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.map.delete(key);
            return undefined;
        }
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }
    set(key, value, ttlMs) {
        if (ttlMs <= 0)
            return;
        if (this.map.has(key))
            this.map.delete(key);
        this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
        while (this.map.size > this.max) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined)
                break;
            this.map.delete(oldest);
        }
    }
    invalidateMatching(predicate) {
        let n = 0;
        for (const key of [...this.map.keys()]) {
            if (predicate(key)) {
                this.map.delete(key);
                n++;
            }
        }
        return n;
    }
    clear() {
        this.map.clear();
    }
    get size() {
        return this.map.size;
    }
}
const ONE_HOUR = 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
const ONE_MIN = 60 * 1000;
const TTL_BY_RESOURCE = {
    flexible_asset_types: ONE_HOUR,
    flexible_asset_fields: ONE_HOUR,
    password_categories: ONE_HOUR,
    configuration_types: ONE_HOUR,
    configuration_statuses: ONE_HOUR,
    organizations: FIVE_MIN,
    locations: FIVE_MIN,
    configurations: ONE_MIN,
    contacts: ONE_MIN,
    documents: ONE_MIN,
    flexible_assets: ONE_MIN,
};
const NEVER_CACHE = new Set(["passwords"]);
const DEFAULT_TTL_MS = ONE_MIN;
export function ttlForResource(resource) {
    if (NEVER_CACHE.has(resource))
        return 0;
    return TTL_BY_RESOURCE[resource] ?? DEFAULT_TTL_MS;
}
export function resourceFromPath(path) {
    const stripped = path.replace(/^\/+/, "");
    const segment = stripped.split("/")[0] ?? "";
    return segment.split("?")[0] ?? "";
}
