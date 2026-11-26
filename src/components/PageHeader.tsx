import { ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import burneesLogo from "@/assets/burnees-logo.png";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional page-specific action(s) rendered on the right side. */
  rightSlot?: ReactNode;
}

/**
 * iOS-style large title. A compact liquid-glass bar fades in once the big
 * title scrolls away, so the page name and controls are always reachable.
 */
const PageHeader = ({ title, subtitle, rightSlot }: PageHeaderProps) => {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* compact sticky bar */}
      <div
        className={`fixed left-1/2 top-0 z-40 w-full max-w-lg -translate-x-1/2 px-3 transition-all duration-300 ease-out-expo ${
          compact ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        }`}
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        aria-hidden={!compact}
      >
        <div className="liquid-glass flex h-12 items-center gap-2.5 rounded-full pl-2 pr-3">
          <img src={burneesLogo} alt="" className="h-8 w-8 rounded-full" />
          <span className="min-w-0 flex-1 truncate font-display text-xl tracking-wider text-foreground">{title}</span>
          {rightSlot}
        </div>
      </div>

      {/* large title */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 px-4 pb-4 pt-4"
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-primary/40 blur-md" aria-hidden />
              <img src={burneesLogo} alt="Bunnies FC" className="relative h-9 w-9 rounded-full ring-1 ring-white/20" />
            </div>
            <span className="eyebrow">Bunnies FC</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[2.6rem] leading-[0.95] tracking-wide text-gradient">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">{subtitle}</p>}
          </div>
          {rightSlot && <div className="flex shrink-0 items-center gap-2 pb-1">{rightSlot}</div>}
        </div>
        <div className="neon-line mt-4 opacity-70" />
      </motion.header>
    </>
  );
};

export default PageHeader;
