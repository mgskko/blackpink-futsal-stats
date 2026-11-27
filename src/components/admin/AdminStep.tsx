import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

interface Props {
  step: number;
  title: string;
  /** one-line state shown when collapsed, e.g. "9명" / "3골" */
  summary?: ReactNode;
  done?: boolean;
  optional?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Numbered, collapsible step of the per-match admin checklist. */
export default function AdminStep({ step, title, summary, done, optional, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={open}>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
            done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground ring-1 ring-border"
          }`}
        >
          {done ? <Check size={14} strokeWidth={3} /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px] font-bold">
            {title}
            {optional && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">선택</span>}
          </div>
          {summary && <div className="mt-0.5 truncate text-xs text-muted-foreground">{summary}</div>}
        </div>
        <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Tappable chip used for quick player / quarter picking. */
export function Chip({ active, onClick, children, tone = "primary", disabled }: { active?: boolean; onClick?: () => void; children: ReactNode; tone?: "primary" | "danger" | "neutral"; disabled?: boolean }) {
  const on =
    tone === "danger" ? "bg-destructive text-destructive-foreground border-destructive" : tone === "neutral" ? "bg-foreground text-background border-foreground" : "gradient-pink text-primary-foreground border-transparent";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-40 ${
        active ? on : "border-border bg-secondary/40 text-foreground/85 hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
