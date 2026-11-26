import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, Users, BarChart3, UserCircle, Shield, ClipboardList, Landmark, Wallet, type LucideIcon } from "lucide-react";
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
    { path: "/tactics", label: t("nav.tactics"), icon: ClipboardList },
    { path: "/guide", label: t("nav.club"), icon: Landmark },
    { path: "/treasury", label: t("nav.treasury"), icon: Wallet },
    { path: "/my", label: t("nav.my"), icon: UserCircle },
    ...(isAdmin ? [{ path: "/admin", label: t("nav.admin"), icon: Shield }] : []),
  ];

  // Detail routes belong to their parent tab.
  const owner = (p: string) => (p.startsWith("/match/") ? "/" : p.startsWith("/player/") || p === "/compare" ? "/players" : p);
  const current = owner(location.pathname);
  const isActive = (path: string) => (path === "/" ? current === "/" : current.startsWith(path));

  return (
    <nav
      aria-label="Primary"
      className="fixed left-1/2 z-50 w-[calc(100%-1.25rem)] max-w-[30rem] -translate-x-1/2"
      style={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom) + 0.25rem))" }}
    >
      <div className="liquid-glass lg-refract flex items-center gap-0.5 rounded-full p-1.5">
        {tabs.map(tab => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.path}
              layout
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
              className={`relative flex h-11 items-center justify-center rounded-full ${
                active ? "flex-[2.4] px-3 text-primary" : "flex-1 text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-capsule"
                  className="absolute inset-0 rounded-full bg-primary/15 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),inset_0_0_0_1px_hsl(var(--primary)/0.35),0_6px_20px_-6px_hsl(var(--primary)/0.6)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <motion.span layout="position" className="relative z-10 flex items-center gap-1.5">
                <Icon
                  size={19}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={active ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.7)]" : ""}
                />
                {active && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08, duration: 0.2 }}
                    className="whitespace-nowrap text-[11px] font-bold tracking-tight"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
