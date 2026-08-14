import { motion } from "framer-motion";
import type { SportFilter } from "@/lib/sport";
import { sportLabel, sportEmoji } from "@/lib/sport";

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
    <div className={`inline-flex rounded-full border border-border bg-card/70 p-1 backdrop-blur ${className ?? ""}`}>
      {options.map(s => {
        const active = s === value;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`relative rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {active && (
              <motion.span layoutId="sport-toggle-pill" className="absolute inset-0 rounded-full gradient-pink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative flex items-center gap-1">
              {sportEmoji(s)} {sportLabel(s, isEn)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
