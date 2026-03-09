import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Player, Match, GoalEvent, MatchQuarter, Roster } from "@/hooks/useFutsalData";
import { getPlayerName } from "@/hooks/useFutsalData";
import { getPlayerPosition } from "@/hooks/useCourtStats";
import { computeBestDefenseLine } from "@/hooks/useChemistryStats";

interface Props {
  players: Player[];
  matches: Match[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
  rosters: Roster[];
}

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

const FormationStatsTab = ({ players, matches, goalEvents, allQuarters, rosters }: Props) => {
  const navigate = useNavigate();

  // Compute all-time match count per player (for global 10-match filter)
  const playerMatchCount = useMemo(() => {
    const map = new Map<number, Set<number>>();
    rosters.forEach(r => {
      if (!map.has(r.player_id)) map.set(r.player_id, new Set());
      map.get(r.player_id)!.add(r.match_id);
    });
    const result = new Map<number, number>();
    map.forEach((matchSet, pid) => result.set(pid, matchSet.size));
    return result;
  }, [rosters]);

  const has10Matches = (pid: number) => (playerMatchCount.get(pid) || 0) >= 10;

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
      .filter(([pid, d]) => d.total >= 3 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), rate: Math.round((d.cleanSheet / d.total) * 100), cleanSheet: d.cleanSheet, total: d.total }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10),
  [gkStats, players, playerMatchCount]);

  const openDoorRanking = useMemo(() =>
    [...gkStats.entries()]
      .filter(([pid, d]) => d.total >= 3 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), avgConceded: d.conceded / d.total, total: d.total }))
      .sort((a, b) => b.avgConceded - a.avgConceded)
      .slice(0, 5),
  [gkStats, players, playerMatchCount]);

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
      .filter(([pid, d]) => d.total >= 5 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), winRate: Math.round((d.wins / d.total) * 100), wins: d.wins, total: d.total }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);
  }, [allQuarters, players, playerMatchCount]);

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
      .filter(([pid, d]) => d.quarters >= 5 && d.assists > d.goals && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), goals: d.goals, assists: d.assists, quarters: d.quarters }))
      .sort((a, b) => (b.assists - b.goals) - (a.assists - a.goals))
      .slice(0, 5);
  }, [allQuarters, goalEvents, players, playerMatchCount]);

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
      .filter(([pid, d]) => d.quarters >= 5 && d.teamGoals >= 3 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), usage: Math.round((d.ownGoals / d.teamGoals) * 100), ownGoals: d.ownGoals, teamGoals: d.teamGoals }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }, [allQuarters, goalEvents, players, playerMatchCount]);

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

  // ─── NEW: 6 spicy formation rankings ───

  // 1. 전방 캠핑족: FW AP high but team conceded rate highest
  const campingRanking = useMemo(() => {
    const fwData = new Map<number, { ap: number; conceded: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const fws = getPositionPlayers(q.lineup, "FW");
      fws.forEach(pid => {
        const cur = fwData.get(pid) || { ap: 0, conceded: 0, quarters: 0 };
        cur.conceded += q.score_against || 0;
        cur.quarters++;
        fwData.set(pid, cur);
      });
    });
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      [g.goal_player_id, g.assist_player_id].forEach(pid => {
        if (!pid) return;
        if (getPlayerPosition(q.lineup, pid) === "FW") {
          const cur = fwData.get(pid);
          if (cur) cur.ap++;
        }
      });
    });
    return [...fwData.entries()]
      .filter(([pid, d]) => d.quarters >= 5 && d.ap >= 3 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), ap: d.ap, concededPerQ: d.conceded / d.quarters, quarters: d.quarters }))
      .sort((a, b) => b.concededPerQ - a.concededPerQ)
      .slice(0, 5);
  }, [allQuarters, goalEvents, players, playerMatchCount]);

  // 2. 수비형 공격수: FW AP ≈ 0 but lowest conceded
  const defensiveFWRanking = useMemo(() => {
    const fwData = new Map<number, { ap: number; conceded: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const fws = getPositionPlayers(q.lineup, "FW");
      fws.forEach(pid => {
        const cur = fwData.get(pid) || { ap: 0, conceded: 0, quarters: 0 };
        cur.conceded += q.score_against || 0;
        cur.quarters++;
        fwData.set(pid, cur);
      });
    });
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      [g.goal_player_id, g.assist_player_id].forEach(pid => {
        if (!pid) return;
        if (getPlayerPosition(q.lineup, pid) === "FW") {
          const cur = fwData.get(pid);
          if (cur) cur.ap++;
        }
      });
    });
    return [...fwData.entries()]
      .filter(([pid, d]) => d.quarters >= 5 && d.ap <= 2 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), ap: d.ap, concededPerQ: d.conceded / d.quarters, quarters: d.quarters }))
      .sort((a, b) => a.concededPerQ - b.concededPerQ)
      .slice(0, 5);
  }, [allQuarters, goalEvents, players, playerMatchCount]);

  // 3. 수트라이커: DF goals
  const strikerDFRanking = useMemo(() => {
    const dfGoals = new Map<number, { goals: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const dfs = getPositionPlayers(q.lineup, "DF");
      dfs.forEach(pid => {
        const cur = dfGoals.get(pid) || { goals: 0, quarters: 0 };
        cur.quarters++;
        dfGoals.set(pid, cur);
      });
    });
    goalEvents.forEach(g => {
      if (g.is_own_goal || !g.goal_player_id) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      if (getPlayerPosition(q.lineup, g.goal_player_id) === "DF") {
        const cur = dfGoals.get(g.goal_player_id);
        if (cur) cur.goals++;
      }
    });
    return [...dfGoals.entries()]
      .filter(([, d]) => d.goals >= 1)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), goals: d.goals, quarters: d.quarters }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);
  }, [allQuarters, goalEvents, players]);

  // 4. 무임승차 VIP: FW AP=0 but win rate 80%+
  const freeRiderRanking = useMemo(() => {
    const fwData = new Map<number, { ap: number; wins: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const fws = getPositionPlayers(q.lineup, "FW");
      const won = (q.score_for || 0) > (q.score_against || 0);
      fws.forEach(pid => {
        const cur = fwData.get(pid) || { ap: 0, wins: 0, quarters: 0 };
        cur.quarters++;
        if (won) cur.wins++;
        fwData.set(pid, cur);
      });
    });
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      const q = allQuarters.find(mq => mq.match_id === g.match_id && mq.quarter === g.quarter);
      if (!q?.lineup) return;
      [g.goal_player_id, g.assist_player_id].forEach(pid => {
        if (!pid) return;
        if (getPlayerPosition(q.lineup, pid) === "FW") {
          const cur = fwData.get(pid);
          if (cur) cur.ap++;
        }
      });
    });
    return [...fwData.entries()]
      .filter(([pid, d]) => d.quarters >= 5 && d.ap === 0 && (d.wins / d.quarters) >= 0.8 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), winRate: Math.round((d.wins / d.quarters) * 100), wins: d.wins, quarters: d.quarters }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);
  }, [allQuarters, goalEvents, players, playerMatchCount]);

  // 5. 소년가장 키퍼: GK clean sheet when team scored 0-1
  const boyBreadwinnerRanking = useMemo(() => {
    const gkData = new Map<number, { saves: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const gks = getPositionPlayers(q.lineup, "GK");
      const teamScored = q.score_for || 0;
      const conceded = q.score_against || 0;
      if (teamScored <= 1 && conceded === 0) {
        gks.forEach(pid => {
          const cur = gkData.get(pid) || { saves: 0, quarters: 0 };
          cur.saves++;
          cur.quarters++;
          gkData.set(pid, cur);
        });
      } else {
        gks.forEach(pid => {
          const cur = gkData.get(pid) || { saves: 0, quarters: 0 };
          cur.quarters++;
          gkData.set(pid, cur);
        });
      }
    });
    return [...gkData.entries()]
      .filter(([pid, d]) => d.saves >= 1 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), saves: d.saves, quarters: d.quarters }))
      .sort((a, b) => b.saves - a.saves)
      .slice(0, 5);
  }, [allQuarters, players, playerMatchCount]);

  // 6. 빙하기 메이커: lowest combined score when on field (FW/DF)
  const iceAgeRanking = useMemo(() => {
    const data = new Map<number, { totalScore: number; quarters: number }>();
    allQuarters.forEach(q => {
      if (!q.lineup) return;
      const fws = getPositionPlayers(q.lineup, "FW");
      const dfs = getPositionPlayers(q.lineup, "DF");
      const combined = (q.score_for || 0) + (q.score_against || 0);
      [...fws, ...dfs].forEach(pid => {
        const cur = data.get(pid) || { totalScore: 0, quarters: 0 };
        cur.totalScore += combined;
        cur.quarters++;
        data.set(pid, cur);
      });
    });
    return [...data.entries()]
      .filter(([pid, d]) => d.quarters >= 10 && has10Matches(pid))
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), avgScore: d.totalScore / d.quarters, quarters: d.quarters }))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5);
  }, [allQuarters, players, playerMatchCount]);

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

      {boyBreadwinnerRanking.length > 0 && (
        <RankingCard title="소년가장 키퍼 — 최후의 보루" emoji="🧤" desc="앞에서 똥을 싸도 묵묵히 치워냅니다. 빈공 상황 속에서 팀을 멱살 잡고 캐리한 최고의 거미손입니다.">
          {boyBreadwinnerRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.saves}회`} sub={`GK ${d.quarters}쿼터 출전`} total={boyBreadwinnerRanking.length} />
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

      {strikerDFRanking.length > 0 && (
        <RankingCard title="수트라이커 — 라모스 빙의" emoji="⚔️" desc="수비하라고 뒤에 뒀더니 기어코 올라가서 골을 박아 넣습니다. 버니즈 최고의 수트라이커입니다.">
          {strikerDFRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.goals}골`} sub={`DF ${d.quarters}쿼터 출전`} total={strikerDFRanking.length} />
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

      {campingRanking.length > 0 && (
        <RankingCard title="전방 캠핑족 — 수비 알러지" emoji="⛺" desc="상대 골대 앞에 텐트를 치고 돌아오지 않습니다! 골은 넣지만 수비 가담을 절대 하지 않아 수비수들을 과로사하게 만드는 이기적인 공격수입니다.">
          {campingRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={d.concededPerQ.toFixed(1)} sub={`AP ${d.ap} | FW ${d.quarters}Q | 쿼터당 실점`} total={campingRanking.length} />
          ))}
        </RankingCard>
      )}

      {defensiveFWRanking.length > 0 && (
        <RankingCard title="수비형 공격수 — 전방의 미친개" emoji="🛡️" desc="골은 안 넣고 상대 수비수들 발목만 물어뜯습니다. 득점보다 전방 압박과 수비에 진심인 수비형 공격수입니다.">
          {defensiveFWRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={d.concededPerQ.toFixed(2)} sub={`AP ${d.ap} | FW ${d.quarters}Q | 쿼터당 실점`} total={defensiveFWRanking.length} />
          ))}
        </RankingCard>
      )}

      {freeRiderRanking.length > 0 && (
        <RankingCard title="무임승차 VIP — 승리 토템" emoji="🚌" desc="필드 위에서 숨만 쉬어도 팀이 이깁니다! 존재 자체가 승리를 부르는 완벽한 승리 토템이자 무임승차 VIP입니다.">
          {freeRiderRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.winRate}%`} sub={`${d.wins}/${d.quarters}Q 승 | AP 0`} total={freeRiderRanking.length} />
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

      {/* Special */}
      <div className="mb-2 mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">🧊 특수 지표</div>

      {iceAgeRanking.length > 0 && (
        <RankingCard title="빙하기 메이커 — 수면제 축구" emoji="🧊" desc="이 선수가 서는 순간 구장의 온도가 떨어집니다. 보는 사람을 숨 막히게 만드는 수면제 축구의 창시자입니다.">
          {iceAgeRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={d.avgScore.toFixed(2)} sub={`${d.quarters}Q 출전 | 쿼터당 양팀 합산`} total={iceAgeRanking.length} />
          ))}
        </RankingCard>
      )}

      {/* Hexagon Player */}
      <div className="mb-2 mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">🔷 멀티 플레이어</div>
      {(() => {
        const hexPlayers = new Map<number, { fw: number; df: number; gk: number; margin: number; quarters: number }>();
        allQuarters.forEach(q => {
          if (!q.lineup) return;
          const diff = (q.score_for || 0) - (q.score_against || 0);
          const parsed = { GK: getPositionPlayers(q.lineup, "GK"), DF: getPositionPlayers(q.lineup, "DF"), FW: getPositionPlayers(q.lineup, "FW") };
          Object.entries(parsed).forEach(([pos, pids]) => {
            pids.forEach(pid => {
              const cur = hexPlayers.get(pid) || { fw: 0, df: 0, gk: 0, margin: 0, quarters: 0 };
              if (pos === "FW") cur.fw++;
              else if (pos === "DF") cur.df++;
              else if (pos === "GK") cur.gk++;
              cur.margin += diff;
              cur.quarters++;
              hexPlayers.set(pid, cur);
            });
          });
        });
        const hexRanking = [...hexPlayers.entries()]
          .filter(([pid, d]) => d.fw >= 2 && d.df >= 2 && d.gk >= 1 && d.quarters >= 10 && has10Matches(pid))
          .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), margin: d.margin, quarters: d.quarters, fw: d.fw, df: d.df, gk: d.gk }))
          .sort((a, b) => b.margin - a.margin)
          .slice(0, 5);
        if (hexRanking.length === 0) return null;
        return (
          <RankingCard title="헥사곤 플레이어" emoji="🔷" desc="FW/DF/GK 모든 포지션 소화 + 누적 마진 최고">
            {hexRanking.map((d, i) => (
              <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.margin > 0 ? "+" : ""}${d.margin}`} sub={`FW${d.fw} DF${d.df} GK${d.gk} (${d.quarters}Q)`} total={hexRanking.length} />
            ))}
          </RankingCard>
        );
      })()}
    </motion.div>
  );
};

export default FormationStatsTab;
