import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { resolveTeamName } from "@/lib/displayName";
import type { Match, Team, Result } from "@/hooks/useFutsalData";

interface Props {
  matches: Match[];
  teams: Team[];
  results: Result[];
  currentMatchId: number;
  opponentName: string;
  lang: string;
}

export default function HeadToHead({ matches, teams, results, currentMatchId, opponentName, lang }: Props) {
  const navigate = useNavigate();
  const isEn = (lang ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const tn = (n: string | null | undefined) => resolveTeamName(n ?? "", lang);

  const history = useMemo(() => {
    const target = (opponentName ?? "").trim();
    if (!target) return [];
    const ids = teams.filter(t => !t.is_ours && (t.name ?? "").trim() === target).map(t => t.match_id);
    const set = new Set(ids);
    return matches
      .filter(m => set.has(m.id) && !m.is_custom)
      .map(m => {
        const mt = teams.filter(t => t.match_id === m.id);
        const ours = mt.find(t => t.is_ours);
        const opp = mt.find(t => !t.is_ours);
        const rOurs = results.find(r => r.match_id === m.id && r.team_id === ours?.id);
        return {
          id: m.id,
          date: m.date,
          result: rOurs?.result ?? null,
          scoreFor: rOurs?.score_for ?? null,
          scoreAgainst: rOurs?.score_against ?? null,
          oppName: opp?.name ?? target,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [matches, teams, results, opponentName]);

  const tally = useMemo(() => {
    let w = 0, d = 0, l = 0;
    history.forEach(h => {
      if (h.result === "승") w++;
      else if (h.result === "무") d++;
      else if (h.result === "패") l++;
    });
    return { w, d, l, total: w + d + l };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {L("이 상대와의 이전 맞대결 기록이 없습니다.", "No previous meetings against this opponent.")}
      </div>
    );
  }

  const pct = (n: number) => (tally.total ? (n / tally.total) * 100 : 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-1 text-center text-xs font-bold tracking-wider text-primary">
          {L("상대 전적", "HEAD TO HEAD")} · {tn(opponentName)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            [tally.w, L("승", "Wins"), "bg-blue-500/20 text-blue-400 border-blue-500/30"],
            [tally.d, L("무", "Draws"), "bg-muted text-muted-foreground border-border"],
            [tally.l, L("패", "Losses"), "bg-red-500/20 text-red-400 border-red-500/30"],
          ].map(([v, label, cls], i) => (
            <div key={i}>
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border font-display text-lg ${cls}`}>{v as number}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{label as string}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-blue-500" style={{ width: `${pct(tally.w)}%` }} />
          <div className="bg-muted-foreground/50" style={{ width: `${pct(tally.d)}%` }} />
          <div className="bg-red-500" style={{ width: `${pct(tally.l)}%` }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {history.map((h, i) => (
          <button
            key={h.id}
            onClick={() => h.id !== currentMatchId && navigate(`/match/${h.id}`)}
            className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary ${i < history.length - 1 ? "border-b border-border" : ""} ${h.id === currentMatchId ? "bg-primary/5" : ""}`}
          >
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{h.date}</div>
              <div className="truncate text-sm font-medium text-foreground">
                {L("버니즈", "Bunnies")} vs {tn(h.oppName)}
                {h.id === currentMatchId && <span className="ml-1.5 text-[10px] text-primary">({L("이 경기", "this match")})</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-foreground">{h.scoreFor ?? "-"} : {h.scoreAgainst ?? "-"}</span>
              {h.result && (
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  h.result === "승" ? "bg-blue-500/20 text-blue-400" : h.result === "패" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                }`}>
                  {h.result === "승" ? L("승", "W") : h.result === "패" ? L("패", "L") : L("무", "D")}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
