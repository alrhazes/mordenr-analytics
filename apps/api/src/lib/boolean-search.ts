/** MySQL InnoDB default; words shorter than this are not FULLTEXT-indexed. */
export const FULLTEXT_MIN_WORD_LEN = 4;

export function tokenizeNameInput(input: string, maxTokens = 6): string[] {
  let s = input.trim();
  if (!s) return [];

  s = s.replace(/\s+/g, " ");
  const raw = s.split(" ");
  const tokens: string[] = [];

  for (const tok of raw) {
    const cleaned = tok
      .replace(/[^\p{L}\p{N}'/.-]+/gu, "")
      .replace(/^[-'./]+|[-'./]+$/g, "");
    if (!cleaned) continue;
    tokens.push(cleaned);
    if (tokens.length >= maxTokens) break;
  }

  return tokens;
}

export function buildLikeNameTokens(
  input: string,
  maxTokens = 6,
): string[] {
  return tokenizeNameInput(input, maxTokens).map((token) =>
    token.toLowerCase(),
  );
}

/**
 * Build a FULLTEXT boolean query for voter names.
 * Returns null when the query mixes long and short tokens — caller should use LIKE instead.
 */
export function buildBooleanNameQuery(
  input: string,
  maxTokens = 6,
): string | null {
  const tokens = tokenizeNameInput(input, maxTokens);
  if (!tokens.length) return null;

  const shortTokens = tokens.filter(
    (token) => token.length < FULLTEXT_MIN_WORD_LEN,
  );
  const longTokens = tokens.filter(
    (token) => token.length >= FULLTEXT_MIN_WORD_LEN,
  );

  if (shortTokens.length && longTokens.length) {
    return null;
  }

  if (shortTokens.length) {
    return tokens.map((token) => `+${token}*`).join(" ");
  }

  const last = longTokens.pop()!;
  const parts = longTokens.map((token) => `+${token}`);
  parts.push(`+${last}*`);
  return parts.join(" ");
}

export function shouldUseLikeNameSearch(input: string, maxTokens = 6): boolean {
  const tokens = tokenizeNameInput(input, maxTokens);
  if (!tokens.length) return false;

  const hasShort = tokens.some(
    (token) => token.length < FULLTEXT_MIN_WORD_LEN,
  );
  const hasLong = tokens.some(
    (token) => token.length >= FULLTEXT_MIN_WORD_LEN,
  );
  return hasShort && hasLong;
}
