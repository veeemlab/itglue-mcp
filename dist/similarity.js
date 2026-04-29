export function normalize(value) {
    return value
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}
export function jaroWinkler(rawA, rawB) {
    const a = rawA;
    const b = rawB;
    if (a === b)
        return a.length === 0 ? 1 : 1;
    if (!a.length || !b.length)
        return 0;
    const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
    const aMatches = new Array(a.length).fill(false);
    const bMatches = new Array(b.length).fill(false);
    let matches = 0;
    for (let i = 0; i < a.length; i++) {
        const start = Math.max(0, i - matchDistance);
        const end = Math.min(i + matchDistance + 1, b.length);
        for (let j = start; j < end; j++) {
            if (bMatches[j])
                continue;
            if (a.charCodeAt(i) !== b.charCodeAt(j))
                continue;
            aMatches[i] = true;
            bMatches[j] = true;
            matches++;
            break;
        }
    }
    if (matches === 0)
        return 0;
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < a.length; i++) {
        if (!aMatches[i])
            continue;
        while (!bMatches[k])
            k++;
        if (a.charCodeAt(i) !== b.charCodeAt(k))
            transpositions++;
        k++;
    }
    const m = matches;
    const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
    let prefix = 0;
    const maxPrefix = Math.min(4, a.length, b.length);
    for (let i = 0; i < maxPrefix; i++) {
        if (a.charCodeAt(i) === b.charCodeAt(i))
            prefix++;
        else
            break;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
}
export function similarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na && !nb)
        return 1;
    if (!na || !nb)
        return 0;
    return jaroWinkler(na, nb);
}
export function classifyConfidence(score) {
    if (score >= 0.95)
        return "Update";
    if (score >= 0.8)
        return "ManualReview";
    return "CreateNew";
}
