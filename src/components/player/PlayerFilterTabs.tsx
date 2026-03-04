import type { Match } from "@/hooks/useFutsalData";

export type FilterMode = "all" | "year" | "custom";

interface PlayerFilterTabsProps {
  filterMode: FilterMode;
  selectedYear: string;
  years: string[];
  onFilterChange: (mode: FilterMode, year?: string) => void;
}

const PlayerFilterTabs = ({ filterMode, selectedYear, years, onFilterChange }: PlayerFilterTabsProps) => {
  return (
    <div className="mx-4 mt-4 space-y-2">
      {/* Primary filter tabs */}
      <div className="flex rounded-lg border border-border bg-card overflow-hidden">
        {([
          ["all", "종합"] as const,
          ["year", "연도별"] as const,
          ["custom", "자체전"] as const,
        ]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onFilterChange(key, key === "year" ? selectedYear || years[0] : undefined)}
            className={`flex-1 py-2 text-xs font-bold transition-all ${
              filterMode === key
                ? "gradient-pink text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Year selector (only visible when year mode) */}
      {filterMode === "year" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {years.map(y => (
            <button
              key={y}
              onClick={() => onFilterChange("year", y)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                selectedYear === y
                  ? "gradient-pink text-primary-foreground"
                  : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerFilterTabs;

export function getAvailableYears(matches: Match[]): string[] {
  const years = new Set(matches.map(m => m.date.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

export function filterMatchesByMode(
  matches: Match[],
  filterMode: FilterMode,
  selectedYear?: string
): Match[] {
  switch (filterMode) {
    case "custom":
      return matches.filter(m => m.is_custom);
    case "year":
      return selectedYear ? matches.filter(m => m.date.startsWith(selectedYear)) : matches;
    default:
      return matches;
  }
}
