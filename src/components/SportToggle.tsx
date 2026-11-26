import { motion } from "framer-motion";
import type { SportFilter } from "@/lib/sport";
import { sportLabel, sportEmoji } from "@/lib/sport";
import { cn } from "@/lib/utils";

interface Props {
  value: SportFilter;
  onChange: (v: SportFilter) => void;
  isEn: boolean;
  className?: string;
  /** hide the "All" segment (default: shown) */
  withAll?: boolean;
}

const SPORTS: SportFilter[] = ["all", "soccer", "futsal"];

export default function SportToggle({ value, onChange, isEn, className, withAll = true }: Props) {
  const options = withAll ? SPORTS : SPORTS.filter(s => s !== "all");
  return (
    <div role="tablist" className={cn("liquid-glass inline-flex rounded-full p-1", className)}>
      {options.map(s => {
        const active = s === value;
        return (
          <button
            key={s}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={`relative flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {active && (
              <motion.span layoutId="sport-toggle-pill" className="absolute inset-0 rounded-full gradient-pink" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative flex items-center justify-center gap-1">
              {sportEmoji(s)} {sportLabel(s, isEn)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
