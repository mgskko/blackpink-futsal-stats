import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, Users, BarChart3, UserCircle, Shield, ClipboardList, Landmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

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

  const activePath = tabs.find((t) => isActive(t.path))?.path ?? "/";
  const [pulseKey, setPulseKey] = useState(activePath);
  useEffect(() => {
    setPulseKey(activePath);
  }, [activePath]);

  return (
    <nav
      className="fixed left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 px-2"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <motion.div
        key={pulseKey}
        initial={{ backdropFilter: "blur(40px) saturate(200%)" }}
        animate={{ backdropFilter: "blur(24px) saturate(180%)" }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative flex items-center justify-around gap-1 rounded-full border border-white/20 bg-white/10 p-2 backdrop-blur-2xl shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.3)] dark:bg-white/[0.06] dark:border-white/10"
      >
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              whileTap={{ scale: 0.92 }}
              className={`group relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Sliding glass pill behind active tab */}
              {active && (
                <motion.div
                  layoutId="activeNavPill"
                  className="absolute inset-0 rounded-2xl border border-white/30 bg-white/15 backdrop-blur-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_4px_18px_-4px_hsl(330_100%_71%/0.45)] dark:bg-white/10 dark:border-white/15"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {/* Quick expanding glow ring on selection */}
              <AnimatePresence>
                {active && (
                  <motion.span
                    key="glow"
                    initial={{ opacity: 0.7, scale: 0.4 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      boxShadow:
                        "0 0 0 1px hsl(var(--primary) / 0.5), 0 0 24px 4px hsl(var(--primary) / 0.45)",
                    }}
                  />
                )}
              </AnimatePresence>
              <div className="relative z-10 flex h-9 w-9 items-center justify-center">
                <Icon
                  size={18}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]" : ""}
                />
              </div>
              <span
                className={`relative z-10 text-[9px] font-semibold tracking-wide ${active ? "text-primary" : ""}`}
              >
                {tab.label}
              </span>
              {/* Bottom indicator dot */}
              {active && (
                <motion.span
                  layoutId="activeNavDot"
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.9)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </nav>
  );
};

export default BottomNav;
