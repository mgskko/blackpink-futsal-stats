import { MATCH_FORMATS, DEFAULT_FORMAT } from "@/lib/positions";

export type SportKey = "futsal" | "soccer";

const FORMAT_SPORT: Record<string, SportKey> = MATCH_FORMATS.reduce((acc, f) => {
  acc[f.code] = f.sport;
  return acc;
}, {} as Record<string, SportKey>);

/** Resolve the sport of a match: explicit format first, then the legacy match_type text. */
export function sportOfMatch(m: { match_format?: string | null; match_type?: string | null } | null | undefined): SportKey {
  if (!m) return "futsal";
  const fmt = m.match_format ?? undefined;
  if (fmt && FORMAT_SPORT[fmt]) return FORMAT_SPORT[fmt];
  const t = (m.match_type ?? "").toLowerCase();
  if (t.includes("축구") || t.includes("soccer") || t.includes("football")) return "soccer";
  if (t.includes("풋살") || t.includes("futsal")) return "futsal";
  return FORMAT_SPORT[DEFAULT_FORMAT] ?? "futsal";
}

export function filterMatchesBySport<T extends { match_format?: string | null; match_type?: string | null }>(
  matches: T[],
  sport: SportKey
): T[] {
  return matches.filter(m => sportOfMatch(m) === sport);
}

export const sportLabel = (sport: SportKey, isEn: boolean) =>
  sport === "soccer" ? (isEn ? "Football" : "축구") : isEn ? "Futsal" : "풋살";
