import { motion } from "framer-motion";

interface MatchQuarter {
  id: number;
  match_id: number;
  quarter: number;
  score_for: number;
  score_against: number;
  lineup: any;
}

interface Props {
  quarters: MatchQuarter[];
  ourTeamName: string;
  opponentTeamName: string;
}

export default function QuarterScoreboard({ quarters, ourTeamName, opponentTeamName }: Props) {
  if (quarters.length === 0) return null;
  const sorted = [...quarters].sort((a, b) => a.quarter - b.quarter);
  const totalFor = sorted.reduce((s, q) => s + (q.score_for || 0), 0);
  const totalAgainst = sorted.reduce((s, q) => s + (q.score_against || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card overflow-hidden">
      <h2 className="px-4 pt-3 pb-2 font-display text-sm tracking-wider text-primary">QUARTER SCORE</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium min-w-[60px]">팀</th>
              {sorted.map(q => (
                <th key={q.quarter} className="px-1.5 py-2 text-center font-medium min-w-[28px]">{q.quarter}Q</th>
              ))}
              <th className="px-3 py-2 text-center font-bold border-l border-border min-w-[36px]">합</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-medium text-primary text-[11px] whitespace-nowrap">{ourTeamName}</td>
              {sorted.map(q => (
                <td key={q.quarter} className={`px-1.5 py-2 text-center font-bold ${q.score_for > q.score_against ? "text-primary" : q.score_for < q.score_against ? "text-muted-foreground" : "text-foreground"}`}>
                  {q.score_for}
                </td>
              ))}
              <td className={`px-3 py-2 text-center font-display text-base border-l border-border ${totalFor > totalAgainst ? "text-primary text-glow" : "text-foreground"}`}>{totalFor}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-foreground text-[11px] whitespace-nowrap">{opponentTeamName}</td>
              {sorted.map(q => (
                <td key={q.quarter} className={`px-1.5 py-2 text-center font-bold ${q.score_against > q.score_for ? "text-primary" : q.score_against < q.score_for ? "text-muted-foreground" : "text-foreground"}`}>
                  {q.score_against}
                </td>
              ))}
              <td className={`px-3 py-2 text-center font-display text-base border-l border-border ${totalAgainst > totalFor ? "text-primary text-glow" : "text-foreground"}`}>{totalAgainst}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
