import { getPlayerPosition, getPlayerTeamInLineup } from "./useCourtStats";
import type { Player, MatchQuarter } from "./useFutsalData";

export interface QuarterRecord { wins: number; draws: number; losses: number; }
export interface PlayerQuarterForm {
  playerId: number;
  name: string;
  perQuarter: Record<number, QuarterRecord>;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  totalQuarters: number;
  winRate: number;
  best: { quarter: number; winRate: number; played: number } | null;
  worst: { quarter: number; winRate: number; played: number } | null;
  earlyWinRate: number;
  lateWinRate: number;
  earlyQuarters: number;
  lateQuarters: number;
}

function isCustomLineup(lineup: any): boolean {
  return lineup && typeof lineup === "object" && !Array.isArray(lineup) && (lineup.teamA || lineup.teamB);
}

export function computeQuarterForm(players: Player[], quarters: MatchQuarter[]): PlayerQuarterForm[] {
  const map = new Map<number, Record<number, QuarterRecord>>();
  const validIds = players.map(p => p.id);

  quarters.forEach(q => {
    if (!q.lineup) return;
    const baseDiff = (q.score_for || 0) - (q.score_against || 0);
    validIds.forEach(pid => {
      const pos = getPlayerPosition(q.lineup, pid);
      if (!pos || pos === "Bench") return;
      let diff = baseDiff;
      if (isCustomLineup(q.lineup)) {
        const t = getPlayerTeamInLineup(q.lineup, pid);
        if (t === "teamB") diff = -baseDiff;
      }
      const rec = map.get(pid) || {};
      const qr = rec[q.quarter] || { wins: 0, draws: 0, losses: 0 };
      if (diff > 0) qr.wins++;
      else if (diff < 0) qr.losses++;
      else qr.draws++;
      rec[q.quarter] = qr;
      map.set(pid, rec);
    });
  });

  return players.map(p => {
    const perQuarter = map.get(p.id) || {};
    let tw = 0, td = 0, tl = 0;
    let earlyW = 0, earlyT = 0, lateW = 0, lateT = 0;
    let best: PlayerQuarterForm["best"] = null;
    let worst: PlayerQuarterForm["worst"] = null;
    Object.entries(perQuarter).forEach(([qStr, r]) => {
      const qNum = Number(qStr);
      const total = r.wins + r.draws + r.losses;
      tw += r.wins; td += r.draws; tl += r.losses;
      if (qNum <= 2) { earlyW += r.wins; earlyT += total; }
      else { lateW += r.wins; lateT += total; }
      if (total >= 3) {
        const wr = (r.wins / total) * 100;
        if (!best || wr > best.winRate) best = { quarter: qNum, winRate: Math.round(wr), played: total };
        if (!worst || wr < worst.winRate) worst = { quarter: qNum, winRate: Math.round(wr), played: total };
      }
    });
    const totalQuarters = tw + td + tl;
    return {
      playerId: p.id,
      name: p.name,
      perQuarter,
      totalWins: tw, totalDraws: td, totalLosses: tl, totalQuarters,
      winRate: totalQuarters > 0 ? Math.round((tw / totalQuarters) * 100) : 0,
      best, worst,
      earlyWinRate: earlyT > 0 ? Math.round((earlyW / earlyT) * 100) : 0,
      lateWinRate: lateT > 0 ? Math.round((lateW / lateT) * 100) : 0,
      earlyQuarters: earlyT,
      lateQuarters: lateT,
    };
  });
}

export function generateTacticalComment(f: PlayerQuarterForm): string {
  if (f.totalQuarters < 5) return "표본이 부족합니다. 더 많은 출전이 누적되면 분석이 정확해져요.";
  const lines: string[] = [];
  if (f.best && f.best.winRate >= 70) {
    const tag = f.best.quarter <= 2 ? "슬로우 스타터 킬러" : f.best.quarter >= 5 ? "막판 해결사" : "중반 지배자";
    lines.push(`${f.best.quarter}쿼터 승률 ${f.best.winRate}%의 '${tag}'. 해당 쿼터엔 무조건 기용하세요.`);
  }
  if (f.worst && f.worst.winRate <= 30) {
    lines.push(`${f.worst.quarter}쿼터 승률 ${f.worst.winRate}%로 매우 낮음. 해당 시간대엔 교체 카드를 고려하세요.`);
  }
  if (f.earlyQuarters >= 5 && f.lateQuarters >= 5) {
    if (f.earlyWinRate - f.lateWinRate >= 25) lines.push("전반(1~2Q) 승률이 후반보다 크게 높은 '체력 한계형' 자원.");
    else if (f.lateWinRate - f.earlyWinRate >= 25) lines.push("후반(3Q+) 승률이 더 높은 '슈퍼 서브형' 자원.");
  }
  return lines.length > 0 ? lines.join(" ") : "쿼터별 승률 편차가 적은 안정적인 자원입니다.";
}