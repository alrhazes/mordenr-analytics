/** Port of bdcat buildBooleanNameQuery for FULLTEXT name search. */
export function buildBooleanNameQuery(
  input: string,
  maxTokens = 6,
): string | null {
  let s = input.trim();
  if (!s) return null;

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

  if (!tokens.length) return null;

  const last = tokens.pop()!;
  const parts = tokens.map((t) => `+${t}`);
  parts.push(`+${last}*`);
  return parts.join(" ");
}
