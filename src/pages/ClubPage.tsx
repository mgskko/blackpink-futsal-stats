import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, ClipboardList, Shield, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";

/** Club hub: everything that isn't matches / players / stats lives one tap away here. */
export default function ClubPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);

  const items = [
    { to: "/tactics", icon: ClipboardList, title: L("전술 · 스쿼드 뎁스", "Tactics & depth"), desc: L("포지션별 순번과 작전판", "Depth chart and boards"), hue: "from-emerald-500/25" },
    { to: "/treasury", icon: Wallet, title: L("회비 장부", "Treasury"), desc: L("월 회비 납부 현황 · 잔액", "Monthly dues and balance"), hue: "from-amber-500/25" },
    { to: "/guide", icon: BookOpen, title: L("클럽하우스", "Clubhouse"), desc: L("가이드 · 구단 역사 · 유니폼", "Guide, history, kits"), hue: "from-sky-500/25" },
    ...(isAdmin ? [{ to: "/admin", icon: Shield, title: L("관리자", "Admin"), desc: L("경기 등록 · 기록 정리", "Fixtures and match records"), hue: "from-pink-500/30" }] : []),
  ];

  return (
    <div className="relative z-10">
      <PageHeader title="CLUB" subtitle={L("버니즈 FC", "Bunnies FC")} />
      <div className="space-y-2.5 px-4">
        {items.map((it, i) => (
          <motion.button
            key={it.to}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(it.to)}
            className={`surface flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br ${it.hue} to-transparent p-5 text-left`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <it.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">{it.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{it.desc}</span>
            </span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
