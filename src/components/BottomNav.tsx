import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, Users, BarChart3, UserCircle, Shield, Landmark, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

interface Tab {
  path: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Floating liquid-glass tab bar. Inactive tabs are icon-only so 7–8
 * destinations fit a 375 px phone; the active tab grows a glass capsule that
 * springs between positions and reveals its label.
 */
const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useTranslation();

  const tabs: Tab[] = [
    { path: "/", label: t("nav.matches"), icon: Trophy },
    { path: "/players", label: t("nav.players"), icon: Users },
    { path: "/stats", label: t("nav.stats"), icon: BarChart3 },
    { path: "/club", label: t("nav.club"), icon: Landmark },
    { path: "/my", label: t("nav.my"), icon: UserCircle },
    ...(isAdmin ? [{ path: "/admin", label: t("nav.admin"), icon: Shield }] : []),
  ];

  // Detail routes belong to their parent tab.
  const owner = (p: string) =>
    p.startsWith("/match/")
      ? "/"
      : p.startsWith("/player/") || p === "/compare"
        ? "/players"
        : ["/tactics", "/treasury", "/guide"].some(x => p.startsWith(x))
          ? "/club"
          : p;
  const current = owner(location.pathname);
  const isActive = (path: string) => (path === "/" ? current === "/" : current.startsWith(path));

  return (
    <nav
      aria-label="Primary"
      className="fixed left-1/2 z-50 w-[calc(100%-1.25rem)] max-w-[30rem] -translate-x-1/2"
      style={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom) + 0.25rem))" }}
    >
      <div className="liquid-glass lg-refract flex items-center gap-0.5 rounded-full p-1">
        {tabs.map(tab => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              whileTap={{ scale: 0.9 }}
              className={`relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-capsule"
                  className="absolute inset-0 rounded-full bg-primary/15 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),inset_0_0_0_1px_hsl(var(--primary)/0.35),0_6px_20px_-6px_hsl(var(--primary)/0.6)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 1.9}
                className={`relative z-10 ${active ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.7)]" : ""}`}
              />
              <span className="relative z-10 text-[10px] font-bold tracking-tight">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
