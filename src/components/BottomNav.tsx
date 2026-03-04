import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, Users, BarChart3 } from "lucide-react";

const tabs = [
  { path: "/", label: "경기", icon: Trophy },
  { path: "/players", label: "선수", icon: Users },
  { path: "/stats", label: "통계", icon: BarChart3 },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-all duration-200 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                size={22}
                className={active ? "drop-shadow-[0_0_8px_hsl(330,100%,71%)]" : ""}
              />
              <span className={`text-xs font-medium ${active ? "text-glow" : ""}`}>
                {tab.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 h-[2px] w-12 -translate-x-1/2 gradient-pink rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
