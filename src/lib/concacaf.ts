// ─────────────────────────────────────────────────────────────
// 북중미모드 (2026 World Cup mode) — form badges named after national teams.
// v2: rating-based (src/lib/matchRating.ts), sport-aware thresholds
// (football goals are ~2.5x scarcer than futsal), one badge per country,
// strongest first. Window = the player's last N played matches.
// ─────────────────────────────────────────────────────────────
import type { GoalEvent, Match, MatchQuarter, Player, Result, Roster, Team } from "@/hooks/useFutsalData";
import { computeMatchRatings, type MatchRatingDetail } from "@/lib/matchRating";
import { computeDataMOM, computeDualDataMOM } from "@/hooks/useMatchAnalysis";
import { sportOfMatch } from "@/lib/sport";

export interface ConcacafBadge {
  key: string;
  country: string;
  country_en: string;
  text: string;
  text_en: string;
  /** slump badges are shown in a muted tone */
  negative?: boolean;
  /** higher = more impressive, used for ordering */
  weight: number;
}

export interface ConcacafCtx {
  matches: Match[];
  rosters: Roster[];
  goalEvents: GoalEvent[];
  quarters: MatchQuarter[];
  teams: Team[];
  results: Result[];
  players: Player[];
  overrideKeyed?: Map<string, number>;
}

interface Played {
  match: Match;
  rating: MatchRatingDetail | null;
  goals: number;
  assists: number;
  result: "승" | "무" | "패" | null;
  roles: Set<string>;
  isMom: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n: number, d = 1) => n.toFixed(d);

/** Per-match facts for the player's most recent `n` matches (newest first). */
function lastPlayed(pid: number, ctx: ConcacafCtx, n: number): Played[] {
  const ids = new Set(ctx.rosters.filter(r => r.player_id === pid).map(r => r.match_id));
  const recent = ctx.matches.filter(m => ids.has(m.id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  return recent.map(m => {
    const qs = ctx.quarters.filter(q => q.match_id === m.id);
    const evs = ctx.goalEvents.filter(g => g.match_id === m.id);
    const overrides = new Map<number, number>();
    ctx.overrideKeyed?.forEach((v, k) => {
      const [mid, p] = k.split(":").map(Number);
      if (mid === m.id) overrides.set(p, v);
    });
    const rating = computeMatchRatings({ match: m, quarters: qs, goalEvents: evs, rosters: ctx.rosters.filter(r => r.match_id === m.id), overrides }).get(pid) ?? null;
    const myTeams = ctx.rosters.filter(r => r.match_id === m.id && r.player_id === pid).map(r => r.team_id);
    const res = ctx.results.find(r => r.match_id === m.id && myTeams.includes(r.team_id))?.result as Played["result"] | undefined;
    const roles = new Set<string>();
    qs.forEach(q => {
      const l: any = q.lineup;
      const units = l && (l.teamA || l.teamB) ? [l.teamA, l.teamB] : [l];
      units.forEach(u => (["GK", "DF", "MF", "FW"] as const).forEach(r => {
        const raw = u?.[r];
        if (raw != null && (Array.isArray(raw) ? raw : [raw]).map(Number).includes(pid)) roles.add(r);
      }));
    });
    let isMom = false;
    if (qs.length) {
      if (m.is_custom) {
        const d = computeDualDataMOM(m.id, ctx.players, ctx.teams, ctx.goalEvents, ctx.quarters, ctx.results, m, overrides);
        isMom = d.teamA?.playerId === pid || d.teamB?.playerId === pid;
      } else {
        isMom = computeDataMOM(m.id, ctx.players, ctx.teams, ctx.goalEvents, ctx.quarters, ctx.results, m, overrides)?.playerId === pid;
      }
    }
    // roster-only legacy matches carry G/A on the roster row
    const goals = m.has_detail_log ? evs.filter(g => g.goal_player_id === pid && !g.is_own_goal).length : ctx.rosters.filter(r => r.match_id === m.id && r.player_id === pid).reduce((a, r) => a + (r.goals || 0), 0);
    const assists = m.has_detail_log ? evs.filter(g => g.assist_player_id === pid).length : ctx.rosters.filter(r => r.match_id === m.id && r.player_id === pid).reduce((a, r) => a + (r.assists || 0), 0);
    return { match: m, rating, goals, assists, result: res ?? null, roles, isMom };
  });
}

export function getConcacafBadges(pid: number, ctx: ConcacafCtx): ConcacafBadge[] {
  const last10 = lastPlayed(pid, ctx, 10);
  const last5 = last10.slice(0, 5);
  if (last5.length < 5) return [];
  const soccerShare = last5.filter(p => sportOfMatch(p.match) === "soccer").length / last5.length;
  // per-match thresholds scale between futsal (1) and football (0.4)
  const k = 1 - 0.6 * soccerShare;
  const rated = last5.filter(p => p.rating);
  const ratings = rated.map(p => p.rating!.rating);
  const avgRating = avg(ratings);
  const goals5 = last5.reduce((a, p) => a + p.goals, 0);
  const assists5 = last5.reduce((a, p) => a + p.assists, 0);
  const moms = last5.filter(p => p.isMom).length;
  const wins = last5.filter(p => p.result === "승").length;
  const losses = last5.filter(p => p.result === "패").length;
  const out: ConcacafBadge[] = [];

  // 🇦🇷 the ace: elite average AND repeatedly the best player on the pitch
  if (rated.length >= 4 && avgRating >= 7.6 && moms >= 2)
    out.push({ key: "ARG", weight: 100, country: "🇦🇷 아르헨티나", country_en: "🇦🇷 Argentina",
      text: `최근 5경기 평균 평점 ${fmt(avgRating, 2)} · Data MOM ${moms}회. 메시처럼 경기를 혼자 끝내는 에이스!`,
      text_en: `Avg rating ${fmt(avgRating, 2)} and ${moms} Player of the Match awards in the last 5 — a Messi-style match winner.` });

  // 🇧🇷 attacking output (G+A per match)
  const apPm = (goals5 + assists5) / 5;
  if (apPm >= 2.4 * k)
    out.push({ key: "BRA", weight: 80 + apPm, country: "🇧🇷 브라질", country_en: "🇧🇷 Brazil",
      text: `최근 5경기 공격포인트 ${goals5 + assists5}개 (경기당 ${fmt(apPm)}). 삼바 군단급 화력!`,
      text_en: `${goals5 + assists5} goal involvements in the last 5 (${fmt(apPm)} per match) — samba firepower.` });

  // 🏴 goals per match
  const gPm = goals5 / 5;
  if (gPm >= 1.6 * k)
    out.push({ key: "ENG", weight: 75 + gPm, country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 잉글랜드", country_en: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England",
      text: `최근 5경기 ${goals5}골 (경기당 ${fmt(gPm)}). 해리 케인급 골 결정력!`,
      text_en: `${goals5} goals in the last 5 (${fmt(gPm)} per match) — Harry Kane-level finishing.` });

  // 🇫🇷 assists per match
  const aPm = assists5 / 5;
  if (aPm >= 1.0 * k)
    out.push({ key: "FRA", weight: 70 + aPm, country: "🇫🇷 프랑스", country_en: "🇫🇷 France",
      text: `최근 5경기 ${assists5}도움 (경기당 ${fmt(aPm)}). 그리즈만급 플레이메이커!`,
      text_en: `${assists5} assists in the last 5 (${fmt(aPm)} per match) — a Griezmann-style creator.` });

  // 🇪🇸 consecutive matches with a goal involvement
  let streak = 0;
  for (const p of last10) { if (p.goals + p.assists > 0) streak++; else break; }
  if (streak >= 6)
    out.push({ key: "ESP", weight: 65 + streak, country: "🇪🇸 스페인", country_en: "🇪🇸 Spain",
      text: `${streak}경기 연속 공격포인트! 멈추지 않는 티키타카.`,
      text_en: `A goal involvement in ${streak} straight matches — relentless tiki-taka.` });

  // 🇩🇪 consistency: never below 6.8, and plays most of every match
  const shares = rated.map(p => p.rating!.share);
  if (rated.length === 5 && Math.min(...ratings) >= 6.8 && avg(shares) >= 0.75)
    out.push({ key: "GER", weight: 60 + avgRating, country: "🇩🇪 독일", country_en: "🇩🇪 Germany",
      text: `최근 5경기 모두 평점 6.8 이상 · 평균 출전 ${Math.round(avg(shares) * 100)}%. 기계 같은 꾸준함!`,
      text_en: `Rated 6.8+ in each of the last 5 while playing ${Math.round(avg(shares) * 100)}% of the minutes — German machine consistency.` });

  // 🇮🇹 defensive quality as DF/GK
  const defRated = rated.filter(p => p.rating!.group === "DF" || p.rating!.group === "GK");
  const defAvg = avg(defRated.map(p => p.rating!.defense));
  const cleanQs = defRated.reduce((a, p) => a + (p.rating!.quartersPlayed - (p.rating!.conceded > 0 ? Math.min(p.rating!.quartersPlayed, p.rating!.conceded) : 0)), 0);
  if (defRated.length >= 3 && defAvg >= 0.45)
    out.push({ key: "ITA", weight: 62 + defAvg * 10, country: "🇮🇹 이탈리아", country_en: "🇮🇹 Italy",
      text: `수비수·골키퍼로 뛴 최근 ${defRated.length}경기 수비 평점 +${fmt(defAvg, 2)}, 무실점에 가까운 쿼터 ${cleanQs}개. 카테나치오!`,
      text_en: `+${fmt(defAvg, 2)} defensive rating across ${defRated.length} matches at the back — catenaccio.` });

  // 🇲🇦 positive on-pitch impact while defending
  const dfImpact = avg(defRated.map(p => p.rating!.impact));
  if (defRated.length >= 3 && dfImpact > 0.15 && wins >= 3)
    out.push({ key: "MAR", weight: 55 + dfImpact * 10, country: "🇲🇦 모로코", country_en: "🇲🇦 Morocco",
      text: `뒷선에서 뛴 경기 출전 중 득실 영향력 +${fmt(dfImpact, 2)} · 최근 5경기 ${wins}승. 철벽 수비 + 승리 공식!`,
      text_en: `+${fmt(dfImpact, 2)} on-pitch impact at the back and ${wins} wins in 5 — Morocco's iron wall.` });

  // 🇨🇻 goalkeeping
  const gkRated = rated.filter(p => p.rating!.group === "GK");
  const gkQ = gkRated.reduce((a, p) => a + p.rating!.quartersPlayed, 0);
  const gkGA = gkRated.reduce((a, p) => a + p.rating!.conceded, 0);
  if (gkQ >= 5 && gkGA / gkQ < 0.8 * k)
    out.push({ key: "CPV", weight: 58, country: "🇨🇻 카보베르데", country_en: "🇨🇻 Cape Verde",
      text: `골키퍼 ${gkQ}쿼터 쿼터당 실점 ${fmt(gkGA / gkQ, 2)}. 기적의 수문장!`,
      text_en: `${fmt(gkGA / gkQ, 2)} conceded per quarter across ${gkQ} quarters in goal — a miracle keeper.` });

  // 🇳🇱 total football: many roles, still good
  const roles = new Set<string>();
  last5.forEach(p => p.roles.forEach(r => roles.add(r)));
  if (roles.size >= 3 && rated.length >= 4 && avgRating >= 7.0)
    out.push({ key: "NED", weight: 52 + roles.size, country: "🇳🇱 네덜란드", country_en: "🇳🇱 Netherlands",
      text: `최근 5경기 ${roles.size}개 포지션(${[...roles].join("·")})을 소화하고도 평균 평점 ${fmt(avgRating, 2)}. 토탈 사커!`,
      text_en: `${roles.size} positions (${[...roles].join("/")}) in the last 5 and still a ${fmt(avgRating, 2)} average — total football.` });

  // 🇰🇷 effort + results: plays nearly every quarter and the team keeps winning
  if (rated.length >= 4 && avg(shares) >= 0.9 && wins >= 3)
    out.push({ key: "KOR", weight: 50, country: "🇰🇷 대한민국", country_en: "🇰🇷 Korea",
      text: `최근 5경기 평균 출전 ${Math.round(avg(shares) * 100)}% · ${wins}승. 꺾이지 않는 마음!`,
      text_en: `${Math.round(avg(shares) * 100)}% of minutes played and ${wins} wins in 5 — the unbreakable spirit.` });

  // 🇰🇷 slump signal (negative)
  if ((rated.length >= 4 && avgRating < 6.0) || losses >= 4)
    out.push({ key: "HMB", weight: 1, negative: true, country: "🇰🇷 홍명보의 강림", country_en: "🇰🇷 Slump Alert",
      text: `최근 5경기 평균 평점 ${rated.length ? fmt(avgRating, 2) : "-"} · ${losses}패. 데이터가 보내는 부진 시그널입니다.`,
      text_en: `Avg rating ${rated.length ? fmt(avgRating, 2) : "-"} and ${losses} losses in the last 5 — the data says it's a slump.` });

  return out.sort((a, b) => b.weight - a.weight);
}
