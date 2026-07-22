import { useTranslation } from "react-i18next";
import type { Player } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";

/**
 * Resolve a player's display name based on the active i18n language.
 * Falls back to the Korean `name` when the English `name_en` is missing.
 */
export function resolveDisplayName(
  player: { name?: string | null; name_en?: string | null } | null | undefined,
  lang: string
): string {
  if (!player) return "";
  if (lang?.startsWith("en") && player.name_en && player.name_en.trim()) {
    return player.name_en;
  }
  return player.name ?? "";
}

/**
 * Hook variant — re-renders when language changes.
 */
export function useDisplayName() {
  const { i18n } = useTranslation();
  return (player: { name?: string | null; name_en?: string | null } | null | undefined) =>
    resolveDisplayName(player, i18n.language);
}

/**
 * Map well-known team names to their EN counterparts.
 * Extend this map as needed; unknown names pass through unchanged.
 */
const TEAM_NAME_MAP: Record<string, string> = {
  "버니즈": "Bunnies FC",
  "상대팀": "Opponent",
};

export function resolveTeamName(name: string | null | undefined, lang: string): string {
  if (!name) return "";
  if (lang?.startsWith("en") && TEAM_NAME_MAP[name]) return TEAM_NAME_MAP[name];
  return name;
}

export function useTeamName() {
  const { i18n } = useTranslation();
  return (name: string | null | undefined) => resolveTeamName(name, i18n.language);
}

/**
 * Hook: returns a `(players, id) => name` resolver reactive to i18n.
 */
export function usePlayerNameResolver() {
  const { i18n } = useTranslation();
  const lang = i18n.language ?? i18n.resolvedLanguage ?? "ko";
  return (players: Player[], id: number) => getPlayerName(players, id, lang);
}

/** Current i18n language flag helper (returns true for English). */
export function useIsEnglish() {
  const { i18n } = useTranslation();
  return (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en");
}

// ─── Bilingual term dictionaries for match/statistics UI ───
// Keep in sync with mem://tech/terminology. If a term isn't in the map the
// original Korean value is returned unchanged.
const GOAL_TYPE_MAP: Record<string, string> = {
  "중거리골": "Long-range",
  "발리골": "Volley",
  "칩슛": "Chip shot",
  "헤딩골": "Header",
  "터닝골": "Turning shot",
  "아크로바틱": "Acrobatic",
  "파포스트골": "Far-post",
  "드리블골": "Solo dribble",
  "엉덩이골": "Hip goal",
  "가슴골": "Chest goal",
  "골문 앞 혼전골": "Scramble goal",
  "역습골": "Counter-attack",
  "세트피스": "Set-piece",
  "PK": "Penalty",
};
const ASSIST_TYPE_MAP: Record<string, string> = {
  "킬패스": "Kill-pass",
  "컷백패스": "Cut-back",
  "컷백": "Cut-back",
  "롱패스": "Long pass",
  "숏패스": "Short pass",
  "스루패스": "Through pass",
  "크로스": "Cross",
  "세컨볼": "Second ball",
};
const BUILDUP_MAP: Record<string, string> = {
  "압박 탈취": "Press win",
  "역습": "Counter",
  "빌드업": "Build-up",
  "세트피스": "Set-piece",
  "골키퍼 롱볼": "GK long ball",
};

export function translateTerm(kind: "goal" | "assist" | "buildup", value: string | null | undefined, lang: string): string {
  if (!value) return "";
  if (!lang?.startsWith("en")) return value;
  const map = kind === "goal" ? GOAL_TYPE_MAP : kind === "assist" ? ASSIST_TYPE_MAP : BUILDUP_MAP;
  return map[value] ?? value;
}

/** Convert DB result string ("승"/"무"/"패") to display label. */
export function displayResultLabel(r: string | null | undefined, lang: string): string {
  if (!r) return "";
  if (!lang?.startsWith("en")) return r;
  return r === "승" ? "W" : r === "패" ? "L" : r === "무" ? "D" : r;
}