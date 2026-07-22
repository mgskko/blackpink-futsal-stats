import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

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
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  if (quarters.length === 0) return null;
  const sorted = [...quarters].sort((a, b) => a.quarter - b.quarter);
  const totalFor = sorted.reduce((s, q) => s + (q.score_for || 0), 0);
  const totalAgainst = sorted.reduce((s, q) => s + (q.score_against || 0), 0);

  const quarterResults = sorted.map(q => {
    if ((q.score_for || 0) > (q.score_against || 0)) return "W" as const;
    if ((q.score_for || 0) < (q.score_against || 0)) return "L" as const;
    return "D" as const;
  });
  const winCount = quarterResults.filter(r => r === "W").length;
  const drawCount = quarterResults.filter(r => r === "D").length;
  const lossCount = quarterResults.filter(r => r === "L").length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 1 }} className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h2 className="font-display text-sm tracking-wider text-primary">QUARTER SCORE</h2>
        <span className="text-[10px] text-muted-foreground">{L("세부 쿼터 단위 전적", "Per-Quarter Record")}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium min-w-[60px]">{L("팀", "Team")}</th>
              {sorted.map((q, idx) => (
                <th key={q.quarter} className={`px-1.5 py-2 text-center font-medium min-w-[28px] ${quarterResults[idx] === "W" ? "text-blue-400" : quarterResults[idx] === "L" ? "text-red-400" : ""}`}>{q.quarter}Q</th>
              ))}
              <th className="px-3 py-2 text-center font-bold border-l border-border min-w-[36px]">{L("합", "Sum")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-medium text-primary text-[11px] whitespace-nowrap">{ourTeamName}</td>
              {sorted.map((q, idx) => (
                <td key={q.quarter} className={`px-1.5 py-2 text-center font-bold ${quarterResults[idx] === "W" ? "text-blue-400" : quarterResults[idx] === "L" ? "text-red-400" : "text-foreground"}`}>
                  {q.score_for}
                </td>
              ))}
              <td className={`px-3 py-2 text-center font-display text-base border-l border-border ${totalFor > totalAgainst ? "text-primary text-glow" : "text-foreground"}`}>{totalFor}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-foreground text-[11px] whitespace-nowrap">{opponentTeamName}</td>
              {sorted.map((q, idx) => (
                <td key={q.quarter} className={`px-1.5 py-2 text-center font-bold ${quarterResults[idx] === "L" ? "text-blue-400" : quarterResults[idx] === "W" ? "text-red-400" : "text-foreground"}`}>
                  {q.score_against}
                </td>
              ))}
              <td className={`px-3 py-2 text-center font-display text-base border-l border-border ${totalAgainst > totalFor ? "text-primary text-glow" : "text-foreground"}`}>{totalAgainst}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Quarter results summary */}
      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-secondary/20">
        <span className="text-[10px] text-muted-foreground">{L("쿼터별 전적", "Quarter Record")}</span>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-blue-400">{winCount}{L("승", "W")}</span>
          <span className="text-muted-foreground">{drawCount}{L("무", "D")}</span>
          <span className="text-red-400">{lossCount}{L("패", "L")}</span>
          <span className="text-[10px] text-muted-foreground font-normal ml-1">({sorted.length}{L("쿼터", "Q")})</span>
        </div>
      </div>
    </motion.div>
  );
}
