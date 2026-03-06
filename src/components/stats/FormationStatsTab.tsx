import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Player, Match, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";
import { getPlayerPosition } from "@/hooks/useCourtStats";
import { computeBestDefenseLine } from "@/hooks/useChemistryStats";

interface Props {
  players: Player[];
  matches: Match[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
}

// Helper: parse lineup to get players by position
function getPositionPlayers(lineup: any, pos: string): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  if (!lineup[pos]) return [];
  return (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).map(Number);
}

function getFieldPlayers(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  const result: number[] = [];
  ["GK", "DF", "MF", "FW"].forEach(pos => {
    if (lineup[pos]) (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).forEach((id: any) => result.push(Number(id)));
  });
  return result;
}

function getBenchPlayers(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  if (!lineup.Bench) return [];
  return (Array.isArray(lineup.Bench) ? lineup.Bench : [lineup.Bench]).map(Number);
}

const FormationStatsTab = ({ players, matches, goalEvents, allQuarters }: Props) => {
  const navigate = useNavigate();

  // ─── GK Stats ───
  const gkStats = useMemo(() => {
    const gkMap = new Map<number, { total: number; cleanSheet: number; conceded: number; ap: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const gks = getPositionPlayers(q.lineup, "GK");
      const conceded = q.score_against || 0;
      gks.forEach(pid => {
        const cur = gkMap.get(pid) || { total: 0, cleanSheet: 0, conceded: 0, ap: 0 };
        cur.total++;
        if (conceded === 0) cur.cleanSheet++;
        cur.conceded += conceded;
        gkMap.set(pid, cur);
      });
    });
    // AP during GK quarters
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      const gks = getPositionPlayers(q.lineup, "GK");
      if (g.goal_player_id && gks.includes(g.goal_player_id)) {
        const cur = gkMap.get(g.goal_player_id) || { total: 0, cleanSheet: 0, conceded: 0, ap: 0 };
        cur.ap++;
        gkMap.set(g.goal_player_id, cur);
      }
      if (g.assist_player_id && gks.includes(g.assist_player_id)) {
        const cur = gkMap.get(g.assist_player_id) || { total: 0, cleanSheet: 0, conceded: 0, ap: 0 };
        cur.ap++;
        gkMap.set(g.assist_player_id, cur);
      }
    });
    return gkMap;
  }, [allQuarters, goalEvents]);

  const cleanSheetRanking = useMemo(() =>
    [...gkStats.entries()]
      .filter(([, d]) => d.total >= 3)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), rate: Math.round((d.cleanSheet / d.total) * 100), cleanSheet: d.cleanSheet, total: d.total }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10),
  [gkStats, players]);

  const openDoorRanking = useMemo(() =>
    [...gkStats.entries()]
      .filter(([, d]) => d.total >= 3)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), avgConceded: d.conceded / d.total, total: d.total }))
      .sort((a, b) => b.avgConceded - a.avgConceded)
      .slice(0, 5),
  [gkStats, players]);

  const sweeperKeeperRanking = useMemo(() =>
    [...gkStats.entries()]
      .filter(([, d]) => d.ap > 0)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), ap: d.ap, total: d.total }))
      .sort((a, b) => b.ap - a.ap)
      .slice(0, 5),
  [gkStats, players]);

  // ─── DF Stats ───
  const dfAssistRanking = useMemo(() => {
    const dfAssistMap = new Map<number, number>();
    goalEvents.forEach(g => {
      if (!g.assist_player_id || g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      const pos = getPlayerPosition(q.lineup, g.assist_player_id);
      if (pos === "DF") dfAssistMap.set(g.assist_player_id, (dfAssistMap.get(g.assist_player_id) || 0) + 1);
    });
    return [...dfAssistMap.entries()]
      .map(([pid, count]) => ({ id: pid, name: getPlayerName(players, pid), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [goalEvents, allQuarters, players]);

  const dfWinRateRanking = useMemo(() => {
    const dfMap = new Map<number, { wins: number; total: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const dfs = getPositionPlayers(q.lineup, "DF");
      const won = (q.score_for || 0) > (q.score_against || 0);
      dfs.forEach(pid => {
        const cur = dfMap.get(pid) || { wins: 0, total: 0 };
        cur.total++;
        if (won) cur.wins++;
        dfMap.set(pid, cur);
      });
    });
    return [...dfMap.entries()]
      .filter(([, d]) => d.total >= 5)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), winRate: Math.round((d.wins / d.total) * 100), wins: d.wins, total: d.total }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);
  }, [allQuarters, players]);

  const cbPartnership = useMemo(() => computeBestDefenseLine(players, allQuarters, 5), [players, allQuarters]);

  // ─── FW Stats ───
  const false9Ranking = useMemo(() => {
    const fwMap = new Map<number, { goals: number; assists: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const fws = getPositionPlayers(q.lineup, "FW");
      fws.forEach(pid => {
        if (!fwMap.has(pid)) fwMap.set(pid, { goals: 0, assists: 0, quarters: 0 });
        fwMap.get(pid)!.quarters++;
      });
    });
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      if (g.goal_player_id && getPlayerPosition(q.lineup, g.goal_player_id) === "FW") {
        const cur = fwMap.get(g.goal_player_id);
        if (cur) cur.goals++;
      }
      if (g.assist_player_id && getPlayerPosition(q.lineup, g.assist_player_id) === "FW") {
        const cur = fwMap.get(g.assist_player_id);
        if (cur) cur.assists++;
      }
    });
    return [...fwMap.entries()]
      .filter(([, d]) => d.quarters >= 5 && d.assists > d.goals)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), goals: d.goals, assists: d.assists, quarters: d.quarters }))
      .sort((a, b) => (b.assists - b.goals) - (a.assists - a.goals))
      .slice(0, 5);
  }, [allQuarters, goalEvents, players]);

  const highUsageRanking = useMemo(() => {
    const fwGoalMap = new Map<number, { ownGoals: number; teamGoals: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const fws = getPositionPlayers(q.lineup, "FW");
      const teamGoals = q.score_for || 0;
      fws.forEach(pid => {
        const cur = fwGoalMap.get(pid) || { ownGoals: 0, teamGoals: 0, quarters: 0 };
        cur.teamGoals += teamGoals;
        cur.quarters++;
        fwGoalMap.set(pid, cur);
      });
    });
    goalEvents.forEach(g => {
      if (g.is_own_goal || !g.goal_player_id) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      if (getPlayerPosition(q.lineup, g.goal_player_id) === "FW") {
        const cur = fwGoalMap.get(g.goal_player_id);
        if (cur) cur.ownGoals++;
      }
    });
    return [...fwGoalMap.entries()]
      .filter(([, d]) => d.quarters >= 5 && d.teamGoals >= 3)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), usage: Math.round((d.ownGoals / d.teamGoals) * 100), ownGoals: d.ownGoals, teamGoals: d.teamGoals }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }, [allQuarters, goalEvents, players]);

  // ─── Bench / Physical Stats ───
  const gameChangerRanking = useMemo(() => {
    const changerMap = new Map<number, { bestSwing: number; totalSwings: number; count: number }>();
    const sortedQ = [...allQuarters].sort((a, b) => a.match_id - b.match_id || a.quarter - b.quarter);
    for (let i = 1; i < sortedQ.length; i++) {
      const prev = sortedQ[i - 1];
      const curr = sortedQ[i];
      if (prev.match_id !== curr.match_id) continue;
      if (!prev.lineup || !curr.lineup) continue;
      const prevBench = getBenchPlayers(prev.lineup);
      const currField = getFieldPlayers(curr.lineup);
      const prevMargin = (prev.score_for || 0) - (prev.score_against || 0);
      const currMargin = (curr.score_for || 0) - (curr.score_against || 0);
      const swing = currMargin - prevMargin;
      // Players who went from bench to field
      prevBench.forEach(pid => {
        if (currField.includes(pid)) {
          const cur = changerMap.get(pid) || { bestSwing: -999, totalSwings: 0, count: 0 };
          cur.count++;
          cur.totalSwings += swing;
          if (swing > cur.bestSwing) cur.bestSwing = swing;
          changerMap.set(pid, cur);
        }
      });
    }
    return [...changerMap.entries()]
      .filter(([, d]) => d.count >= 2)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), avgSwing: d.totalSwings / d.count, bestSwing: d.bestSwing, count: d.count }))
      .sort((a, b) => b.avgSwing - a.avgSwing)
      .slice(0, 5);
  }, [allQuarters, players]);

  const ironManRanking = useMemo(() => {
    const playerStreaks = new Map<number, number>();
    const matchIds = [...new Set(allQuarters.map(q => q.match_id))];
    matchIds.forEach(mid => {
      const mq = allQuarters.filter(q => q.match_id === mid).sort((a, b) => a.quarter - b.quarter);
      const streakMap = new Map<number, number>();
      mq.forEach(q => {
        if (!q.lineup) return;
        const field = getFieldPlayers(q.lineup);
        const bench = getBenchPlayers(q.lineup);
        field.forEach(pid => {
          streakMap.set(pid, (streakMap.get(pid) || 0) + 1);
          const cur = playerStreaks.get(pid) || 0;
          if ((streakMap.get(pid) || 0) > cur) playerStreaks.set(pid, streakMap.get(pid) || 0);
        });
        bench.forEach(pid => streakMap.set(pid, 0));
      });
    });
    return [...playerStreaks.entries()]
      .filter(([, streak]) => streak >= 2)
      .map(([pid, streak]) => ({ id: pid, name: getPlayerName(players, pid), streak }))
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5);
  }, [allQuarters, players]);

  const RankingCard = ({ title, emoji, desc, children }: { title: string; emoji: string; desc: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 font-display text-lg tracking-wider text-primary">{emoji} {title}</h3>
      <p className="mb-2 text-[10px] text-muted-foreground">{desc}</p>
      <div className="rounded-lg border border-border bg-card overflow-hidden">{children}</div>
    </div>
  );

  const RankItem = ({ i, name, id, value, sub, total }: { i: number; name: string; id: number; value: string; sub?: string; total?: number }) => (
    <div onClick={() => navigate(`/player/${id}`)} className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${total !== undefined && i < total - 1 ? "border-b border-border" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : i === 1 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
        <div>
          <span className="text-sm font-medium text-foreground">{name}</span>
          {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        </div>
      </div>
      <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{value}</span>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* GK Section */}
      <div className="mb-2 mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">🧤 골키퍼 (GK)</div>

      {cleanSheetRanking.length > 0 && (
        <RankingCard title="클린시트 방어율" emoji="🧤" desc="GK 출전 쿼터 중 무실점 비율">
          {cleanSheetRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.rate}%`} sub={`${d.cleanSheet}/${d.total} 쿼터`} total={cleanSheetRanking.length} />
          ))}
        </RankingCard>
      )}

      {openDoorRanking.length > 0 && (
        <RankingCard title="최악의 자동문" emoji="🚪" desc="GK 출전 시 쿼터당 평균 실점 최다">
          {openDoorRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={d.avgConceded.toFixed(2)} sub={`${d.total} 쿼터`} total={openDoorRanking.length} />
          ))}
        </RankingCard>
      )}

      {sweeperKeeperRanking.length > 0 && (
        <RankingCard title="골 넣는 키퍼" emoji="⚡" desc="GK 출전 쿼터 중 공격포인트 기록">
          {sweeperKeeperRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.ap}AP`} sub={`${d.total} 쿼터 출전`} total={sweeperKeeperRanking.length} />
          ))}
        </RankingCard>
      )}

      {/* DF Section */}
      <div className="mb-2 mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">🛡️ 수비수 (DF)</div>

      {dfAssistRanking.length > 0 && (
        <RankingCard title="빌드업 마스터" emoji="🎯" desc="DF 포지션 출전 쿼터에 기록한 어시스트 TOP 5">
          {dfAssistRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.count}회`} total={dfAssistRanking.length} />
          ))}
        </RankingCard>
      )}

      {dfWinRateRanking.length > 0 && (
        <RankingCard title="수비수 승률" emoji="🛡️" desc="DF 출전 시 쿼터 승률 (최소 5쿼터)">
          {dfWinRateRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.winRate}%`} sub={`${d.wins}/${d.total} 쿼터`} total={dfWinRateRanking.length} />
          ))}
        </RankingCard>
      )}

      {cbPartnership.length > 0 && (
        <RankingCard title="영혼의 센터백 듀오" emoji="🤝" desc="동시 DF 출전 시 최소 실점 조합 (최소 5쿼터)">
          {cbPartnership.map((d, i) => (
            <div key={d.names.join("-")} className={`flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-secondary ${i < cbPartnership.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "gradient-pink text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                {d.names.map((n, ni) => (
                  <span key={ni}>
                    <span className="cursor-pointer text-sm font-medium text-foreground hover:text-primary" onClick={() => { const p = players.find(pp => pp.name === n); if (p) navigate(`/player/${p.id}`); }}>{n}</span>
                    {ni < d.names.length - 1 && <span className="text-primary mx-1">&</span>}
                  </span>
                ))}
              </div>
              <div className="text-right">
                <span className={`font-display text-lg ${i === 0 ? "text-primary text-glow" : "text-foreground"}`}>{d.concededPerQ.toFixed(2)}</span>
                <div className="text-[9px] text-muted-foreground">{d.quarters}Q</div>
              </div>
            </div>
          ))}
        </RankingCard>
      )}

      {/* FW Section */}
      <div className="mb-2 mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">⚔️ 공격수 (FW)</div>

      {false9Ranking.length > 0 && (
        <RankingCard title="가짜 9번 (False 9)" emoji="🎭" desc="FW 출전 시 어시스트 > 골인 이타적 공격수">
          {false9Ranking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.assists}A/${d.goals}G`} sub={`FW ${d.quarters}쿼터`} total={false9Ranking.length} />
          ))}
        </RankingCard>
      )}

      {highUsageRanking.length > 0 && (
        <RankingCard title="독박 공격수" emoji="💪" desc="FW 출전 시 팀 골 중 본인 직접 득점 비율">
          {highUsageRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.usage}%`} sub={`${d.ownGoals}/${d.teamGoals} 팀골`} total={highUsageRanking.length} />
          ))}
        </RankingCard>
      )}

      {/* Bench & Physical */}
      <div className="mb-2 mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">🏃 벤치 & 체력</div>

      {gameChangerRanking.length > 0 && (
        <RankingCard title="게임 체인저" emoji="🔥" desc="벤치→투입 후 쿼터 마진 평균 상승폭">
          {gameChangerRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.avgSwing > 0 ? "+" : ""}${d.avgSwing.toFixed(1)}`} sub={`${d.count}회 투입 | 최고 +${d.bestSwing}`} total={gameChangerRanking.length} />
          ))}
        </RankingCard>
      )}

      {ironManRanking.length > 0 && (
        <RankingCard title="혹사 지수 (Iron Man)" emoji="🦾" desc="벤치 휴식 없이 연속 출전 최다 기록">
          {ironManRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.streak}연속`} total={ironManRanking.length} />
          ))}
        </RankingCard>
      )}
    </motion.div>
  );
};

export default FormationStatsTab;
