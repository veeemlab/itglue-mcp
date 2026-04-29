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
function withStrategy(result, strategy, variantsTried) {
    const meta = {
        ...(result.meta ?? {}),
        search_strategy: strategy,
    };
    if (variantsTried)
        meta.search_variants_tried = variantsTried;
    return { ...result, meta };
}
