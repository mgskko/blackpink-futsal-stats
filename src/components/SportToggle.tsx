import { motion } from "framer-motion";
import type { SportKey } from "@/lib/sport";
import { sportLabel } from "@/lib/sport";

interface Props {
  value: SportKey;
  onChange: (v: SportKey) => void;
  isEn: boolean;
  className?: string;
}

const SPORTS: SportKey[] = ["futsal", "soccer"];

export default function SportToggle({ value, onChange, isEn, className }: Props) {
  return (
    <div className={`inline-flex rounded-full border border-border bg-card/70 p-1 backdrop-blur ${className ?? ""}`}>
      {SPORTS.map(s => {
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
              {s === "soccer" ? "⚽" : "🥅"} {sportLabel(s, isEn)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
