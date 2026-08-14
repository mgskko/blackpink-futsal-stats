import { MATCH_FORMATS, DEFAULT_FORMAT } from "@/lib/positions";

export type SportKey = "futsal" | "soccer";
export type SportFilter = SportKey | "all";

const FORMAT_SPORT: Record<string, SportKey> = MATCH_FORMATS.reduce((acc, f) => {
  acc[f.code] = f.sport;
  return acc;
}, {} as Record<string, SportKey>);

/** Resolve the sport of a match: explicit format first, then the legacy match_type text. */
export function sportOfMatch(m: { match_format?: string | null; match_type?: string | null } | null | undefined): SportKey {
  if (!m) return "futsal";
  const fmt = m.match_format ?? undefined;
  const t = (m.match_type ?? "").toLowerCase();
  const fromType: SportKey | null =
    t.includes("축구") || t.includes("soccer") || t.includes("football")
      ? "soccer"
      : t.includes("풋살") || t.includes("futsal")
        ? "futsal"
        : null;
  // Explicit match_type wins when it contradicts a (possibly stale) format code.
  if (fromType) return fromType;
  if (fmt && FORMAT_SPORT[fmt]) return FORMAT_SPORT[fmt];
  return FORMAT_SPORT[DEFAULT_FORMAT] ?? "futsal";
}

export function filterMatchesBySport<T extends { match_format?: string | null; match_type?: string | null }>(
  matches: T[],
  sport: SportFilter
): T[] {
  if (sport === "all") return matches;
  return matches.filter(m => sportOfMatch(m) === sport);
}

export const sportLabel = (sport: SportFilter, isEn: boolean) =>
  sport === "all"
    ? isEn ? "All" : "전체"
    : sport === "soccer"
      ? isEn ? "Football" : "축구"
      : isEn ? "Futsal" : "풋살";

export const sportEmoji = (sport: SportFilter) => (sport === "soccer" ? "⚽" : sport === "futsal" ? "🥅" : "🏅");
