import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, History, KeyRound, Plus, Receipt, Shield, UserCog, Wallet, LayoutGrid,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminGate from "@/components/admin/AdminGate";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AdminAttendance from "@/components/admin/AdminAttendance";
import AdminSquadDepth from "@/components/admin/AdminSquadDepth";
import AdminTreasury from "@/components/admin/AdminTreasury";
import AdminFines from "@/components/admin/AdminFines";
import AdminManageRoles from "@/components/admin/AdminManageRoles";
import AdminPlayerManage from "@/components/admin/AdminPlayerManage";
import AdminTeamHistory from "@/components/admin/AdminTeamHistory";
import { useAllFutsalData, getMatchResult, getMatchSides, type Match } from "@/hooks/useFutsalData";
import { localISODate, parseLocalDate } from "@/lib/utils";

type ToolKey = "attendance" | "dues" | "fines" | "players" | "history" | "depth" | "roles";

const TOOLS: { key: ToolKey; label: string; desc: string; icon: typeof Wallet; render: () => ReactNode }[] = [
  { key: "attendance", label: "참석 체크", desc: "경기별 참석/불참", icon: ClipboardCheck, render: () => <AdminAttendance /> },
  { key: "players", label: "선수 관리", desc: "등록 · 등번호 · 사진", icon: UserCog, render: () => <AdminPlayerManage /> },
  { key: "dues", label: "회비", desc: "월 회비 · 장부", icon: Wallet, render: () => <AdminTreasury /> },
  { key: "fines", label: "벌금", desc: "지각 · 불참 벌금", icon: Receipt, render: () => <AdminFines /> },
  { key: "depth", label: "스쿼드 뎁스", desc: "포지션별 순번", icon: LayoutGrid, render: () => <AdminSquadDepth /> },
  { key: "history", label: "구단 역사", desc: "로고 · 유니폼 · 연혁", icon: History, render: () => <AdminTeamHistory /> },
  { key: "roles", label: "권한", desc: "관리자 지정", icon: KeyRound, render: () => <AdminManageRoles /> },
];

function MatchRow({ match, title, sub, badge, tone, onClick }: { match: Match; title: string; sub: string; badge: string; tone: "warn" | "info" | "ok"; onClick: () => void }) {
  const d = parseLocalDate(match.date);
  const toneCls = tone === "warn" ? "bg-amber-400/15 text-amber-400 ring-amber-400/30" : tone === "info" ? "bg-sky-400/15 text-sky-400 ring-sky-400/30" : "bg-emerald-400/15 text-emerald-400 ring-emerald-400/30";
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]">
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span className="text-[10px] font-bold text-muted-foreground">{d.getMonth() + 1}월</span>
        <span className="font-num text-xl font-extrabold leading-none">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold">{title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${toneCls}`}>{badge}</span>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground/50" />
    </button>
  );
}

function Group({ icon, title, count, children }: { icon: ReactNode; title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-bold text-muted-foreground" style={{ fontFamily: "inherit" }}>
        {icon}
        {title}
        {count != null && <span className="font-num text-[11px]">{count}</span>}
      </h2>
      <div className="surface divide-y divide-white/[0.05] overflow-hidden rounded-2xl">{children}</div>
    </section>
  );
}

const AdminHome = () => {
  const navigate = useNavigate();
  const { matches, teams, results, venues, rosters, goalEvents } = useAllFutsalData();
  const [tool, setTool] = useState<ToolKey | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);

  const { todo, upcoming, done } = useMemo(() => {
    const today = localISODate();
    const venueName = new Map(venues.map(v => [v.id, v.name]));
    const rosterCount = new Map<number, number>();
    rosters.forEach(r => rosterCount.set(r.match_id, (rosterCount.get(r.match_id) ?? 0) + 1));
    const goalCount = new Map<number, number>();
    goalEvents.forEach(g => goalCount.set(g.match_id, (goalCount.get(g.match_id) ?? 0) + 1));
    const rows = [...matches]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .map(m => {
        const sides = getMatchSides(teams, m.id);
        const mr = getMatchResult(teams, results, m.id);
        const sf = mr?.ourResult.score_for ?? 0;
        const sa = mr?.ourResult.score_against ?? 0;
        const title = m.is_custom
          ? `자체전 · ${teams.filter(t => t.match_id === m.id).map(t => t.name).join(" vs ")}`
          : `vs ${sides.opponentTeam?.name ?? "상대 미정"}`;
        const missing: string[] = [];
        if (!rosterCount.get(m.id)) missing.push("명단");
        if (sf + sa === 0 && mr?.ourResult.result === "무" && !goalCount.get(m.id)) missing.push("스코어");
        else if (sf > 0 && !m.has_detail_log && !goalCount.get(m.id)) missing.push("득점자");
        const sub = `${venueName.get(m.venue_id) ?? "구장 미정"} · ${m.match_type}${mr && missing.length === 0 ? ` · ${sf}:${sa}` : ""}`;
        return { m, title, sub, missing, future: m.date > today };
      });
    return {
      upcoming: rows.filter(r => r.future).reverse(),
      todo: rows.filter(r => !r.future && r.missing.length > 0),
      done: rows.filter(r => !r.future && r.missing.length === 0),
    };
  }, [matches, teams, results, venues, rosters, goalEvents]);

  const active = TOOLS.find(t => t.key === tool);
  const open = (id: number) => navigate(`/admin/match/${id}`);

  return (
    <div className="relative z-10">
      <PageHeader title="ADMIN" subtitle="경기 등록 → 경기 후 기록 정리" />
      <div className="space-y-5 px-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/admin/new")}
          className="gradient-pink flex w-full items-center gap-3 rounded-3xl px-5 py-4 text-left text-primary-foreground shadow-[0_16px_40px_-16px_hsl(var(--primary))]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/25"><Plus size={24} strokeWidth={2.6} /></span>
          <span className="flex-1">
            <span className="block text-[17px] font-black">새 경기 등록</span>
            <span className="block text-xs font-semibold opacity-80">날짜 · 상대팀 · 구장 · 명단</span>
          </span>
          <ChevronRight />
        </motion.button>

        {todo.length > 0 && (
          <Group icon={<AlertCircle size={14} className="text-amber-400" />} title="기록 정리가 필요한 경기" count={todo.length}>
            {todo.slice(0, 8).map(r => (
              <MatchRow key={r.m.id} match={r.m} title={r.title} sub={r.sub} badge={`${r.missing.join("·")} 필요`} tone="warn" onClick={() => open(r.m.id)} />
            ))}
          </Group>
        )}

        {upcoming.length > 0 && (
          <Group icon={<CalendarClock size={14} className="text-sky-400" />} title="다가오는 경기" count={upcoming.length}>
            {upcoming.map(r => (
              <MatchRow key={r.m.id} match={r.m} title={r.title} sub={r.sub} badge="예정" tone="info" onClick={() => open(r.m.id)} />
            ))}
          </Group>
        )}

        <Group icon={<CheckCircle2 size={14} className="text-emerald-400" />} title="기록 완료" count={done.length}>
          {(showAllDone ? done : done.slice(0, 5)).map(r => (
            <MatchRow key={r.m.id} match={r.m} title={r.title} sub={r.sub} badge="완료" tone="ok" onClick={() => open(r.m.id)} />
          ))}
          {done.length > 5 && (
            <button onClick={() => setShowAllDone(v => !v)} className="w-full py-3 text-xs font-bold text-primary">
              {showAllDone ? "접기" : `전체 ${done.length}경기 보기`}
            </button>
          )}
        </Group>

        <section>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-bold text-muted-foreground" style={{ fontFamily: "inherit" }}>
            <Shield size={14} /> 클럽 관리
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map(t => (
              <button key={t.key} onClick={() => setTool(t.key)} className="surface pressable flex items-center gap-3 rounded-2xl p-3.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><t.icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">{t.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Sheet open={!!active} onOpenChange={o => !o && setTool(null)}>
        <SheetContent side="bottom" className="mx-auto h-[92dvh] max-w-lg overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-left">{active?.label}</SheetTitle>
          </SheetHeader>
          {active?.render()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const AdminPage = () => (
  <AdminGate>
    <AdminHome />
  </AdminGate>
);

export default AdminPage;
