import { motion } from "framer-motion";
import burneesLogo from "@/assets/burnees-logo.png";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional page-specific action(s) rendered on the right side. */
  rightSlot?: ReactNode;
}

const PageHeader = ({ title, subtitle, rightSlot }: PageHeaderProps) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative z-10 px-4 pt-6 pb-4"
  >
    <div className="mb-4 flex items-center justify-end gap-2">
      <LanguageToggle />
      <ThemeToggle />
    </div>
    <div className="flex items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <img src={burneesLogo} alt="Bunnies FC" className="h-10 w-10 rounded-full" />
        <div>
          <h1 className="font-display text-3xl tracking-wider text-glow text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {rightSlot && <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>}
    </div>
    <div className="mt-4 neon-line opacity-60" />
  </motion.div>
);

export default PageHeader;
