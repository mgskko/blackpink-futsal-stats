import type { GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { formatSeconds, parseTimestamp } from "@/lib/youtube";

interface Props {
  quarters: MatchQuarter[];
  goals: GoalEvent[];
  /** intrasquad: goals of this team go left, the other team right */
  leftTeamId?: number | null;
  isCustom: boolean;
  leftName: string;
  rightName: string;
  isEn: boolean;
  pn: (id: number | null | undefined) => string;
  onPlayer: (id: number) => void;
  onSeek?: (seconds: number) => void;
}

/**
 * FotMob-style event timeline. Quarter dividers carry the quarter score and the
 * running total; our goals sit left, the opponent's (or team B's) right.
 */
export default function MatchTimeline({ quarters, goals, leftTeamId, isCustom, leftName, rightName, isEn, pn, onPlayer, onSeek }: Props) {
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const qNums = [...new Set([...quarters.map(q => q.quarter), ...goals.map(g => g.quarter)])].sort((a, b) => a - b);
  if (qNums.length === 0) return null;
  let runF = 0, runA = 0;

  const Goal = ({ g, side }: { g: GoalEvent; side: "L" | "R" }) => {
    const sec = parseTimestamp(g.video_timestamp);
    const time = sec != null ? (
      <button
        onClick={() => onSeek?.(sec)}
        disabled={!onSeek}
        className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary disabled:bg-muted disabled:text-muted-foreground"
      >
        {onSeek ? "▶ " : ""}{formatSeconds(sec)}
      </button>
    ) : null;
    const tags = [g.goal_type, g.assist_type].filter(Boolean).join(" · ");
    return (
      <div className={`flex items-start gap-2 ${side === "R" ? "flex-row-reverse text-right" : ""}`}>
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[13px] shadow">⚽</span>
        <div className="min-w-0">
          {g.is_own_goal ? (
            <div className="text-[13px] font-bold text-loss">{L("자책골", "Own goal")} · {pn(g.goal_player_id)}</div>
          ) : (
            <button onClick={() => g.goal_player_id && onPlayer(g.goal_player_id)} className="text-[13px] font-bold hover:text-primary">
              {pn(g.goal_player_id)}
            </button>
          )}
          {g.assist_player_id && (
            <div className="text-[11px] text-muted-foreground">
              {L("도움", "Assist")}{" "}
              <button onClick={() => onPlayer(g.assist_player_id!)} className="font-semibold hover:text-primary">{pn(g.assist_player_id)}</button>
            </div>
          )}
          {tags && <div className="text-[10px] text-muted-foreground/80">{tags}</div>}
        </div>
        {time}
      </div>
    );
  };

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5 text-[11px] font-bold text-muted-foreground">
        <span className="truncate">{leftName}</span>
        <span className="text-[13px] text-foreground" style={{ fontFamily: "inherit" }}>{L("경기 타임라인", "Timeline")}</span>
        <span className="truncate text-right">{rightName}</span>
      </div>
      <div className="relative px-4 pb-4">
        <div className="absolute bottom-4 left-1/2 top-2 w-px -translate-x-1/2 bg-white/10" aria-hidden />
        {qNums.map(qn => {
          const q = quarters.find(x => x.quarter === qn);
          const qGoals = goals.filter(g => g.quarter === qn);
          const left = qGoals.filter(g => (isCustom ? g.team_id === leftTeamId : true));
          const right = isCustom ? qGoals.filter(g => g.team_id !== leftTeamId) : [];
          const sf = q?.score_for ?? left.length;
          const sa = q?.score_against ?? right.length;
          runF += sf;
          runA += sa;
          const unknownAgainst = !isCustom ? sa : Math.max(0, sa - right.length);
          return (
            <div key={qn} className="relative pt-3">
              <div className="relative z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold ring-1 ring-border">
                <span className="text-primary">{qn}Q</span>
                <span className="font-num">{sf} - {sa}</span>
                <span className="font-num text-muted-foreground">({runF}-{runA})</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="space-y-2">{left.map(g => <Goal key={g.id} g={g} side="L" />)}</div>
                <div className="space-y-2">
                  {right.map(g => <Goal key={g.id} g={g} side="R" />)}
                  {unknownAgainst > 0 && (
                    <div className="flex flex-row-reverse items-center gap-2 text-right text-[12px] text-muted-foreground">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-loss/20 text-[11px]">⚽</span>
                      {L(`실점 ${unknownAgainst}`, `${unknownAgainst} conceded`)}
                    </div>
                  )}
                </div>
              </div>
              {left.length === 0 && right.length === 0 && unknownAgainst === 0 && (
                <p className="mt-1 text-center text-[10px] text-muted-foreground">{L("득점 없음", "No goals")}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
