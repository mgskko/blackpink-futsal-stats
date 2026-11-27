import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { GoalEvent, MatchQuarter, Player, Roster } from "@/hooks/useFutsalData";
import {
  computeBestDefenseLine, computeDeathLineup, computePassNetwork, computePositionDuosByWinRate,
  computeSynergyMargin, computeToxicDuos, computeTriosByWinRate, computeWithoutYou,
} from "@/hooks/useChemistryStats";
import PlayerAvatar from "@/components/player/PlayerAvatar";

interface Props {
  players: Player[];
  quarters: MatchQuarter[];
  goalEvents: GoalEvent[];
  rosters: Roster[];
  isEn: boolean;
  nameOf: (id: number) => string;
}

const idsIn = (raw: any): number[] => (raw == null ? [] : (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !Number.isNaN(n)));

/** GK + defender pairs: goals conceded per quarter while both were on the pitch (min 6 quarters). */
function keeperDefenderDuos(memberIds: Set<number>, quarters: MatchQuarter[]) {
  const acc = new Map<string, { gk: number; df: number; q: number; ga: number }>();
  quarters.forEach(q => {
    const l: any = q.lineup;
    if (!l || typeof l !== "object") return;
    const units: [any, number][] = l.teamA || l.teamB
      ? [[l.teamA, q.score_against || 0], [l.teamB, q.score_for || 0]]
      : [[l, q.score_against || 0]];
    units.forEach(([u, ga]) => {
      if (!u) return;
      idsIn(u.GK).forEach(gk => idsIn(u.DF).forEach(df => {
        if (!memberIds.has(gk) || !memberIds.has(df)) return;
        const k = `${gk}:${df}`;
        const a = acc.get(k) ?? { gk, df, q: 0, ga: 0 };
        a.q++;
        a.ga += ga;
        acc.set(k, a);
      }));
    });
  });
  return [...acc.values()].filter(a => a.q >= 6).map(a => ({ ...a, perQ: a.ga / a.q })).sort((a, b) => a.perQ - b.perQ || b.q - a.q);
}

function Section({ emoji, title, desc, children, tone = "default" }: { emoji: string; title: string; desc: string; children: ReactNode; tone?: "default" | "bad" }) {
  return (
    <section className={`surface overflow-hidden rounded-2xl ${tone === "bad" ? "opacity-90" : ""}`}>
      <div className="px-4 pb-2 pt-3.5">
        <h3 className={`flex items-center gap-1.5 text-[15px] font-bold ${tone === "bad" ? "text-loss" : ""}`} style={{ fontFamily: "inherit" }}>
          <span>{emoji}</span>
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <div className="divide-y divide-white/[0.05]">{children}</div>
    </section>
  );
}

export default function ChemistryTab({ players, quarters, goalEvents, rosters, isEn, nameOf }: Props) {
  const navigate = useNavigate();
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const memberIds = useMemo(() => new Set(players.map(p => p.id)), [players]);

  const data = useMemo(() => {
    const keep = <T,>(list: T[], ids: (x: T) => number[]) => list.filter(x => ids(x).every(id => memberIds.has(id)));
    return {
      pass: keep(computePassNetwork(players, goalEvents, rosters, 12), x => [x.assisterId, x.scorerId]).slice(0, 5),
      dfDuo: keep(computePositionDuosByWinRate(players, quarters, "DF", rosters, 6, false, goalEvents), x => [x.p1, x.p2]).slice(0, 3),
      fwDuo: keep(computePositionDuosByWinRate(players, quarters, "FW", rosters, 6, false, goalEvents), x => [x.p1, x.p2]).slice(0, 3),
      gkDf: keeperDefenderDuos(memberIds, quarters).slice(0, 3),
      trio: keep(computeTriosByWinRate(players, quarters, 6, false), x => x.ids).slice(0, 3),
      death: computeDeathLineup(players, quarters),
      defLine: keep(computeBestDefenseLine(players, quarters, rosters, 5), x => x.playerIds).slice(0, 2),
      synergy: keep(computeSynergyMargin(players, quarters, rosters, 8), x => [x.p1, x.p2]).slice(0, 4),
      without: keep(computeWithoutYou(players, quarters, 8), x => [x.playerId]).slice(0, 5),
      toxic: keep(computeToxicDuos(players, quarters, rosters, 5), x => [x.p1, x.p2]).slice(0, 3),
    };
  }, [players, quarters, goalEvents, rosters, memberIds]);

  const Faces = ({ ids }: { ids: number[] }) => (
    <div className="flex shrink-0 -space-x-2.5">
      {ids.map(id => {
        const p = byId.get(id);
        return p ? (
          <button key={id} onClick={() => navigate(`/player/${id}`)} className="rounded-full ring-2 ring-background">
            <PlayerAvatar player={p} size={34} />
          </button>
        ) : null;
      })}
    </div>
  );

  const Row = ({ ids, title, sub, value, valueSub, rank }: { ids: number[]; title: string; sub?: string; value: string; valueSub?: string; rank: number }) => (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={`w-4 text-center font-num text-xs font-bold ${rank === 1 ? "text-primary" : "text-muted-foreground"}`}>{rank}</span>
      <Faces ids={ids} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">{title}</div>
        {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
      </div>
      <div className="text-right">
        <div className="font-num text-[15px] font-extrabold">{value}</div>
        {valueSub && <div className="text-[9px] text-muted-foreground">{valueSub}</div>}
      </div>
    </div>
  );

  const Empty = () => <p className="px-4 pb-4 text-xs text-muted-foreground">{L("표본이 부족해요 (라인업 기록이 더 필요합니다)", "Not enough lineup data yet")}</p>;
  const pm = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
  const q = (n: number) => (isEn ? `${n}Q together` : `함께 ${n}쿼터`);

  return (
    <div className="space-y-3">
      <Section emoji="🤝" title={L("환상의 짝꿍", "Telepathic duos")} desc={L("서로의 골을 가장 많이 만든 도움 → 득점 콤비", "Most goals created assister → scorer")}>
        {data.pass.length ? data.pass.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.assisterId, x.scorerId]} title={`${nameOf(x.assisterId)} → ${nameOf(x.scorerId)}`} value={`${x.count}`} valueSub={L("골 합작", "goals")} />
        )) : <Empty />}
      </Section>

      <Section emoji="🧱" title={L("센터백 듀오", "Centre-back pairs")} desc={L("수비수로 함께 뛴 쿼터 승률 (6쿼터 이상)", "Quarter win rate as a DF pair (min. 6 quarters)")}>
        {data.dfDuo.length ? data.dfDuo.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.p1, x.p2]} title={`${nameOf(x.p1)} · ${nameOf(x.p2)}`} sub={`${q(x.quarters)} · ${L("무실점", "clean")} ${x.cleanSheetQuarters}Q`} value={`${Math.round(x.winRate)}%`} valueSub={`${pm(x.marginPerQ)}/Q`} />
        )) : <Empty />}
      </Section>

      <Section emoji="⚔️" title={L("최강 투톱", "Strike partnerships")} desc={L("공격수로 함께 뛴 쿼터 승률과 합작 골", "Quarter win rate and combined goals as a FW pair")}>
        {data.fwDuo.length ? data.fwDuo.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.p1, x.p2]} title={`${nameOf(x.p1)} · ${nameOf(x.p2)}`} sub={`${q(x.quarters)} · ${L("합작", "combined")} ${x.combinedGoals}${L("골", "G")}`} value={`${Math.round(x.winRate)}%`} valueSub={`${pm(x.marginPerQ)}/Q`} />
        )) : <Empty />}
      </Section>

      <Section emoji="🧤" title={L("골키퍼 · 수비 케미", "Keeper–defender bond")} desc={L("골키퍼와 수비수가 함께 섰을 때 쿼터당 실점 (6쿼터 이상)", "Goals conceded per quarter with this GK + DF on the pitch")}>
        {data.gkDf.length ? data.gkDf.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.gk, x.df]} title={`🧤 ${nameOf(x.gk)} · ${nameOf(x.df)}`} sub={q(x.q)} value={x.perQ.toFixed(2)} valueSub={L("실점/쿼터", "GA/Q")} />
        )) : <Empty />}
      </Section>

      <Section emoji="✨" title={L("황금 삼각편대", "Golden trios")} desc={L("셋이 함께 뛴 쿼터 승률이 가장 높은 조합", "Three players with the best quarter win rate together")}>
        {data.trio.length ? data.trio.map((x, i) => (
          <Row key={i} rank={i + 1} ids={x.ids} title={x.ids.map(nameOf).join(" · ")} sub={`${q(x.quarters)} · ${x.totalScored}:${x.totalConceded}`} value={`${Math.round(x.winRate)}%`} valueSub={L("승률", "win")} />
        )) : <Empty />}
      </Section>

      {data.death && (
        <Section emoji="💀" title="THE DEATH LINEUP" desc={L("쿼터당 득실 마진이 가장 압도적인 5인 조합", "The five-player unit with the best margin per quarter")}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Faces ids={data.death.playerIds} />
            <div className="min-w-0 flex-1 truncate text-[12px] font-semibold">{data.death.playerIds.map(nameOf).join(" · ")}</div>
            <div className="text-right">
              <div className="font-num text-lg font-extrabold text-win">{pm(data.death.avgMargin)}</div>
              <div className="text-[9px] text-muted-foreground">{data.death.quarters}Q</div>
            </div>
          </div>
        </Section>
      )}

      <Section emoji="⚡" title={L("시너지", "Synergy")} desc={L("같이 뛸 때와 따로 뛸 때 쿼터당 마진 차이", "Margin per quarter together minus apart")}>
        {data.synergy.length ? data.synergy.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.p1, x.p2]} title={`${nameOf(x.p1)} · ${nameOf(x.p2)}`} sub={`${L("함께", "together")} ${pm(x.togetherMarginPerQ)} · ${L("따로", "apart")} ${pm(x.apartMarginPerQ)}`} value={pm(x.synergy)} valueSub={q(x.togetherQ)} />
        )) : <Empty />}
      </Section>

      <Section emoji="🫥" title={L("없으면 안 되는 선수", "Can't play without")} desc={L("출전 중 마진 − 벤치에 있을 때 마진", "Margin on the pitch minus margin while on the bench")}>
        {data.without.length ? data.without.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.playerId]} title={nameOf(x.playerId)} sub={`${L("출전", "on")} ${pm(x.onFieldMarginPerQ)} · ${L("벤치", "off")} ${pm(x.benchMarginPerQ)}`} value={pm(x.impact)} valueSub={`${x.onFieldQ}Q`} />
        )) : <Empty />}
      </Section>

      <Section emoji="☠️" title={L("파멸의 듀오", "Toxic duos")} desc={L("둘이 함께 뛰면 쿼터당 실점이 치솟는 조합", "Pairs that concede the most per quarter together")} tone="bad">
        {data.toxic.length ? data.toxic.map((x, i) => (
          <Row key={i} rank={i + 1} ids={[x.p1, x.p2]} title={`${nameOf(x.p1)} · ${nameOf(x.p2)}`} sub={q(x.quarters)} value={x.concededPerQ.toFixed(2)} valueSub={L("실점/쿼터", "GA/Q")} />
        )) : <Empty />}
      </Section>
    </div>
  );
}
