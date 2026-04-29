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

interface MaybeArrayDoc {
  data?: unknown;
  meta?: Record<string, unknown>;
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
): T {
  const meta: Record<string, unknown> = {
    ...(result.meta ?? {}),
    search_strategy: strategy,
  };
  if (variantsTried) meta.search_variants_tried = variantsTried;
  return { ...result, meta };
}
