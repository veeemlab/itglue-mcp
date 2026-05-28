export function nameVariants(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (v: string) => {
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

interface MaybeArrayDoc {
  data?: unknown;
  meta?: Record<string, unknown>;
}

interface JsonApiResourceLike {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
}

export interface FuzzyFallbackOptions {
  input: string;
  fetchUnfiltered: () => Promise<MaybeArrayDoc>;
  getName: (resource: JsonApiResourceLike) => string;
  threshold?: number;
}

export async function fuzzyFallbackScan(
  options: FuzzyFallbackOptions,
): Promise<MaybeArrayDoc> {
  const { input, fetchUnfiltered, getName, threshold = 0.75 } = options;
  const result = await fetchUnfiltered();
  const data = result.data;
  if (!Array.isArray(data) || data.length === 0) {
    return withStrategy(result, "client-side-fuzzy-empty");
  }
  const ranked = (data as JsonApiResourceLike[])
    .map((resource) => {
      const candidateName = getName(resource);
      const score = candidateName ? similarityTokenSet(input, candidateName) : 0;
      return { resource, score };
    })
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score);
  const filtered: MaybeArrayDoc = {
    ...result,
    data: ranked.map((entry) => entry.resource),
  };
  return withStrategy(filtered, "client-side-fuzzy", undefined, {
    fuzzy_threshold: threshold,
    fuzzy_candidates: data.length,
    fuzzy_matches: ranked.length,
  });
}

function hasHits(result: MaybeArrayDoc): boolean {
  return Array.isArray(result.data) && result.data.length > 0;
}

export async function searchWithNameFallback<T extends MaybeArrayDoc>(
  input: string | undefined,
  fetchWith: (variant: string | undefined) => Promise<T>,
): Promise<T> {
  if (!input) {
    const result = await fetchWith(undefined);
    return withStrategy(result, "no-name-filter");
  }
  const variants = nameVariants(input);
  let last: T | undefined;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]!;
    const result = await fetchWith(v);
    if (hasHits(result)) {
      const strategy = i === 0 ? "exact" : `fallback:${v}`;
      return withStrategy(result, strategy);
    }
    last = result;
  }
  return withStrategy(last as T, "no-hits", variants);
}

function withStrategy<T extends MaybeArrayDoc>(
  result: T,
  strategy: string,
  variantsTried?: string[],
  extra?: Record<string, unknown>,
): T {
  const meta: Record<string, unknown> = {
    ...(result.meta ?? {}),
    search_strategy: strategy,
    ...(extra ?? {}),
  };
  if (variantsTried) meta.search_variants_tried = variantsTried;
  return { ...result, meta };
}

export function hasAnyHits(result: MaybeArrayDoc): boolean {
  return Array.isArray(result.data) && result.data.length > 0;
}
