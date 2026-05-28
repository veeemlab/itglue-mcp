export function nameVariants(input) {
    const seen = new Set();
    const out = [];
    const push = (v) => {
        if (v && !seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    };
    push(input);
    const firstWord = (input.split(/\s+/)[0] ?? "").trim();
    push(firstWord);
    const stripped = input.normalize("NFKD").replace(/\p{M}/gu, "");
    push(stripped);
    const strippedFirst = (stripped.split(/\s+/)[0] ?? "").trim();
    push(strippedFirst);
    return out;
}
import { similarityTokenSet } from "./similarity.js";
export async function fuzzyFallbackScan(options) {
    const { input, fetchUnfiltered, getName, threshold = 0.75 } = options;
    const result = await fetchUnfiltered();
    const data = result.data;
    if (!Array.isArray(data) || data.length === 0) {
        return withStrategy(result, "client-side-fuzzy-empty");
    }
    const ranked = data
        .map((resource) => {
        const candidateName = getName(resource);
        const score = candidateName ? similarityTokenSet(input, candidateName) : 0;
        return { resource, score };
    })
        .filter((entry) => entry.score >= threshold)
        .sort((a, b) => b.score - a.score);
    const filtered = {
        ...result,
        data: ranked.map((entry) => entry.resource),
    };
    return withStrategy(filtered, "client-side-fuzzy", undefined, {
        fuzzy_threshold: threshold,
        fuzzy_candidates: data.length,
        fuzzy_matches: ranked.length,
    });
}
function hasHits(result) {
    return Array.isArray(result.data) && result.data.length > 0;
}
export async function searchWithNameFallback(input, fetchWith) {
    if (!input) {
        const result = await fetchWith(undefined);
        return withStrategy(result, "no-name-filter");
    }
    const variants = nameVariants(input);
    let last;
    for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const result = await fetchWith(v);
        if (hasHits(result)) {
            const strategy = i === 0 ? "exact" : `fallback:${v}`;
            return withStrategy(result, strategy);
        }
        last = result;
    }
    return withStrategy(last, "no-hits", variants);
}
function withStrategy(result, strategy, variantsTried, extra) {
    const meta = {
        ...(result.meta ?? {}),
        search_strategy: strategy,
        ...(extra ?? {}),
    };
    if (variantsTried)
        meta.search_variants_tried = variantsTried;
    return { ...result, meta };
}
export function hasAnyHits(result) {
    return Array.isArray(result.data) && result.data.length > 0;
}
