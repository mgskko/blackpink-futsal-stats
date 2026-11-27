import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import DetailHeader from "@/components/DetailHeader";
import AdminGate from "@/components/admin/AdminGate";
import AdminMatchEdit from "@/components/admin/AdminMatchEdit";
import AdminMatchCreate from "@/components/admin/AdminMatchCreate";
import { useAllFutsalData, getMatchSides } from "@/hooks/useFutsalData";

/** /admin/match/:id — the post-match checklist for one fixture. */
export function AdminMatchScreen() {
  const { id } = useParams();
  const matchId = Number(id);
  const navigate = useNavigate();
  const { matches, teams } = useAllFutsalData();
  const match = matches.find(m => m.id === matchId);
  const opp = getMatchSides(teams, matchId).opponentTeam?.name;
  return (
    <AdminGate>
      <div className="relative z-10">
        <DetailHeader
          title="경기 기록"
          subtitle={match ? `${match.date} · ${match.is_custom ? "자체전" : `vs ${opp ?? "상대 미정"}`}` : undefined}
          right={
            <button onClick={() => navigate(`/match/${matchId}`)} className="liquid-glass pressable flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-primary">
              경기 화면 <ExternalLink size={12} />
            </button>
          }
        />
        <div className="px-4 pt-3">
          <AdminMatchEdit fixedMatchId={matchId} onDeleted={() => navigate("/admin", { replace: true })} />
        </div>
      </div>
    </AdminGate>
  );
}

/** /admin/new — register a fixture. */
export function AdminNewMatchScreen() {
  return (
    <AdminGate>
      <div className="relative z-10">
        <DetailHeader title="새 경기 등록" subtitle="등록 후 바로 기록 화면으로 이동해요" />
        <div className="px-4 pt-3">
          <AdminMatchCreate />
        </div>
      </div>
    </AdminGate>
  );
}
