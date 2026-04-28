export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function merchantKey(description: string) {
  const normalized = normalizeText(description);
  const withoutRefs = normalized
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\bupi\b/g, "")
    .replace(/\bpaid via\b/g, "")
    .replace(/\bimps\b|\bneft\b|\brtgs\b|\bpos\b|\batm\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const upiMatch = withoutRefs.match(/(?:to|from)?\s*([a-z0-9._-]+)@/);
  if (upiMatch?.[1]) {
    return upiMatch[1];
  }

  return withoutRefs.split(/[-/]/)[0]?.trim() || withoutRefs;
}

export function fingerprint(parts: Array<string | number | undefined>) {
  return parts
    .filter((part) => part !== undefined && part !== "")
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
