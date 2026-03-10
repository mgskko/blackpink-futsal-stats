import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Player, Match, Team, Result, Roster, GoalEvent, MatchQuarter } from "@/hooks/useFutsalData";
import { getPlayerName, computeNonDuplicatedAP } from "@/hooks/useFutsalData";
import { computeAllCourtMargins, getPlayerPosition } from "@/hooks/useCourtStats";

interface Props {
  players: Player[];
  matches: Match[];
  teams: Team[];
  results: Result[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  allQuarters: MatchQuarter[];
}

function getFieldPlayers(lineup: any): number[] {
  if (!lineup || typeof lineup !== "object" || Array.isArray(lineup)) return [];
  const result: number[] = [];
  ["GK", "DF", "MF", "FW"].forEach(pos => {
    if (lineup[pos]) (Array.isArray(lineup[pos]) ? lineup[pos] : [lineup[pos]]).forEach((id: any) => result.push(Number(id)));
  });
  return result;
}

const FunStatsTab = ({ players, matches, teams, results, rosters, goalEvents, allQuarters }: Props) => {
  const navigate = useNavigate();

  // Global 10-match filter
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

  // 1. 유산소의 신: 15Q+, AP 극히 적고, margin <= 0
  const cardioRanking = useMemo(() => {
    const courtMargins = computeAllCourtMargins(players, matches, allQuarters, goalEvents);
    return courtMargins
      .filter(p => has10Matches(p.id) && p.quartersPlayed >= 15 && p.ap <= 2 && p.margin <= 0)
      .sort((a, b) => b.quartersPlayed - a.quartersPlayed || a.margin - b.margin)
      .slice(0, 5);
  }, [players, matches, allQuarters, goalEvents, playerMatchCount]);

  // 2. 전술적 희생양: FW margin top tier but overall margin hurt by DF/GK
  const tacticalVictim = useMemo(() => {
    const playerData: { id: number; name: string; fwMarginPerQ: number; totalMarginPerQ: number; fwQ: number; nonFwQ: number; diff: number }[] = [];
    players.forEach(p => {
      let fwMargin = 0, fwQ = 0, totalMargin = 0, totalQ = 0;
      allQuarters.forEach(q => {
        if (!q.lineup) return;
        const field = getFieldPlayers(q.lineup);
        if (!field.includes(p.id)) return;
        const pos = getPlayerPosition(q.lineup, p.id);
        const diff = (q.score_for || 0) - (q.score_against || 0);
        totalMargin += diff;
        totalQ++;
        if (pos === "FW") { fwMargin += diff; fwQ++; }
      });
      if (fwQ >= 3 && totalQ >= 10 && (totalQ - fwQ) >= 3) {
        const fwMpq = fwMargin / fwQ;
        const totalMpq = totalMargin / totalQ;
        if (fwMpq > totalMpq + 0.3) {
          playerData.push({ id: p.id, name: p.name, fwMarginPerQ: fwMpq, totalMarginPerQ: totalMpq, fwQ, nonFwQ: totalQ - fwQ, diff: fwMpq - totalMpq });
        }
      }
    });
    return playerData.sort((a, b) => b.diff - a.diff).slice(0, 5);
  }, [players, allQuarters]);

  // 3. 얼리버드 vs 슬로우스타터
  const earlyLateRanking = useMemo(() => {
    const earlyMap = new Map<number, number>();
    const lateMap = new Map<number, number>();
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      if (g.goal_player_id) {
        if (g.quarter >= 1 && g.quarter <= 3) earlyMap.set(g.goal_player_id, (earlyMap.get(g.goal_player_id) || 0) + 1);
        if (g.quarter >= 6 && g.quarter <= 8) lateMap.set(g.goal_player_id, (lateMap.get(g.goal_player_id) || 0) + 1);
      }
      if (g.assist_player_id) {
        if (g.quarter >= 1 && g.quarter <= 3) earlyMap.set(g.assist_player_id, (earlyMap.get(g.assist_player_id) || 0) + 1);
        if (g.quarter >= 6 && g.quarter <= 8) lateMap.set(g.assist_player_id, (lateMap.get(g.assist_player_id) || 0) + 1);
      }
    });
    const earlyBirds = [...earlyMap.entries()].map(([pid, count]) => ({ id: pid, name: getPlayerName(players, pid), count })).sort((a, b) => b.count - a.count).slice(0, 3);
    const slowStarters = [...lateMap.entries()].map(([pid, count]) => ({ id: pid, name: getPlayerName(players, pid), count })).sort((a, b) => b.count - a.count).slice(0, 3);
    return { earlyBirds, slowStarters };
  }, [goalEvents, players]);

  // 4. 패배 요정: AP를 올린 경기의 팀 승률이 가장 낮은
  const jinxRanking = useMemo(() => {
    const playerMatchAP = new Map<number, Set<number>>();
    goalEvents.forEach(g => {
      if (g.is_own_goal) return;
      if (g.goal_player_id) {
        if (!playerMatchAP.has(g.goal_player_id)) playerMatchAP.set(g.goal_player_id, new Set());
        playerMatchAP.get(g.goal_player_id)!.add(g.match_id);
      }
      if (g.assist_player_id) {
        if (!playerMatchAP.has(g.assist_player_id)) playerMatchAP.set(g.assist_player_id, new Set());
        playerMatchAP.get(g.assist_player_id)!.add(g.match_id);
      }
    });
    const ranking: { id: number; name: string; winRate: number; wins: number; total: number }[] = [];
    playerMatchAP.forEach((matchIds, pid) => {
      if (matchIds.size < 10) return;
      let wins = 0;
      matchIds.forEach(mid => {
        const pRoster = rosters.find(r => r.player_id === pid && r.match_id === mid);
        if (!pRoster) return;
        const res = results.find(r => r.team_id === pRoster.team_id && r.match_id === mid);
        if (res?.result === "승") wins++;
      });
      ranking.push({ id: pid, name: getPlayerName(players, pid), winRate: Math.round((wins / matchIds.size) * 100), wins, total: matchIds.size });
    });
    return ranking.sort((a, b) => a.winRate - b.winRate).slice(0, 5);
  }, [goalEvents, rosters, results, players]);

  // 5. 낭만 원툴: 고난도 골 비율
  const highlightRanking = useMemo(() => {
    const hardTypes = ["중거리골", "발리골", "칩슛", "헤딩골", "터닝골", "아크로바틱", "파포스트골", "드리블골", "엉덩이골", "가슴골"];
    const playerGoals = new Map<number, { hard: number; total: number }>();
    goalEvents.forEach(g => {
      if (g.is_own_goal || !g.goal_player_id) return;
      const cur = playerGoals.get(g.goal_player_id) || { hard: 0, total: 0 };
      cur.total++;
      if (g.goal_type && hardTypes.some(t => g.goal_type!.includes(t))) cur.hard++;
      playerGoals.set(g.goal_player_id, cur);
    });
    return [...playerGoals.entries()]
      .filter(([, d]) => d.total >= 5 && d.hard >= 2)
      .map(([pid, d]) => ({ id: pid, name: getPlayerName(players, pid), rate: Math.round((d.hard / d.total) * 100), hard: d.hard, total: d.total }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [goalEvents, players]);

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

  const Section = ({ title, emoji, desc, children }: { title: string; emoji: string; desc: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 font-display text-lg tracking-wider text-primary">{emoji} {title}</h3>
      <p className="mb-2 text-[10px] text-muted-foreground">{desc}</p>
      <div className="rounded-lg border border-border bg-card overflow-hidden">{children}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {cardioRanking.length > 0 && (
        <Section title="유산소의 신" emoji="🏃" desc="15쿼터+ 출전, AP 극소, 누적 마진 0 이하인 러닝머신 선수">
          {cardioRanking.map((d, i) => (
            <RankItem key={d.playerId} i={i} name={d.name} id={d.playerId} value={`${d.quartersPlayed}Q`} sub={`AP ${d.ap} | 마진 ${d.margin > 0 ? "+" : ""}${d.margin}`} total={cardioRanking.length} />
          ))}
        </Section>
      )}

      {tacticalVictim.length > 0 && (
        <Section title="전술적 희생양" emoji="🛡️" desc="FW 출전 시 마진 상위권이나, DF/GK 투입으로 전체 마진 손해">
          {tacticalVictim.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`+${d.diff.toFixed(1)}`} sub={`FW ${d.fwMarginPerQ.toFixed(1)}/Q vs 전체 ${d.totalMarginPerQ.toFixed(1)}/Q`} total={tacticalVictim.length} />
          ))}
        </Section>
      )}

      {/* Early Bird vs Slow Starter */}
      <div className="mb-6">
        <h3 className="mb-2 flex items-center gap-2 font-display text-lg tracking-wider text-primary">⏱️ 얼리버드 vs 슬로우 스타터</h3>
        <p className="mb-2 text-[10px] text-muted-foreground">1~3쿼터 vs 6~8쿼터 공격포인트 집중도</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary text-center">🌅 얼리버드 (1~3Q)</div>
            {earlyLateRanking.earlyBirds.map((d, i) => (
              <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.count}AP`} total={earlyLateRanking.earlyBirds.length} />
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="bg-destructive/10 px-3 py-1.5 text-[10px] font-bold text-destructive text-center">🌙 슬로우스타터 (6~8Q)</div>
            {earlyLateRanking.slowStarters.map((d, i) => (
              <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.count}AP`} total={earlyLateRanking.slowStarters.length} />
            ))}
          </div>
        </div>
      </div>

      {jinxRanking.length > 0 && (
        <Section title="패배 요정 (The Jinx)" emoji="🤡" desc="AP를 기록한 경기의 팀 승률이 유독 낮은 선수 (최소 AP 10경기)">
          {jinxRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.winRate}%`} sub={`${d.wins}/${d.total} 경기 승리`} total={jinxRanking.length} />
          ))}
        </Section>
      )}

      {highlightRanking.length > 0 && (
        <Section title="낭만 원툴 (Highlight Reel)" emoji="✨" desc="중거리/발리/칩슛/헤딩 등 고난도 골 비율 최고 (최소 5골, 2+ 고난도)">
          {highlightRanking.map((d, i) => (
            <RankItem key={d.id} i={i} name={d.name} id={d.id} value={`${d.rate}%`} sub={`고난도 ${d.hard}/${d.total} 골`} total={highlightRanking.length} />
          ))}
        </Section>
      )}
    </motion.div>
  );
};

export default FunStatsTab;
