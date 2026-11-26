import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}

/** Height of the bar below the safe area — sticky children offset by this. */
export const DETAIL_HEADER_OFFSET = "calc(env(safe-area-inset-top) + 3.5rem)";

/**
 * Sticky glass top bar for drill-down pages. Pads for the iPhone safe area so
 * it never slides under the Dynamic Island in standalone (PWA) mode.
 */
export default function DetailHeader({ title, subtitle, right }: Props) {
  const navigate = useNavigate();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return (
    <div
      className="sticky z-30 -mt-[env(safe-area-inset-top)] border-b border-white/[0.06] bg-background/70 backdrop-blur-2xl backdrop-saturate-150"
      style={{ top: 0, paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center gap-3 px-3">
        <button
          onClick={back}
          aria-label="Back"
          className="liquid-glass pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-none tracking-wider text-foreground">{title}</h1>
          {subtitle && <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}
