import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, Users, BarChart3, UserCircle, Shield, ClipboardList, Landmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useTranslation();

  const tabs = [
    { path: "/", label: t("nav.matches"), icon: Trophy },
    { path: "/players", label: t("nav.players"), icon: Users },
    { path: "/stats", label: t("nav.stats"), icon: BarChart3 },
    { path: "/tactics", label: t("nav.tactics"), icon: ClipboardList },
    { path: "/guide", label: t("nav.club"), icon: Landmark },
    { path: "/my", label: t("nav.my"), icon: UserCircle },
    ...(isAdmin ? [{ path: "/admin", label: t("nav.admin"), icon: Shield }] : []),
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 px-2">
      <div className="glass-strong flex items-center justify-around gap-1 rounded-full p-2 shadow-2xl">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              className={`group flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 transition-all duration-200 ${
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                  active
                    ? "gradient-pink shadow-[0_0_18px_hsl(330_100%_71%/0.5)]"
                    : ""
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
              </div>
              <span
                className={`text-[9px] font-semibold tracking-wide ${
                  active ? "text-primary" : ""
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
