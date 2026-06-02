import { useTranslation } from "react-i18next";

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