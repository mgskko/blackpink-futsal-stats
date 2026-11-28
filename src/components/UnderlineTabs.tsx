import { motion } from "framer-motion";

interface Props<K extends string> {
  tabs: readonly (readonly [K, string])[];
  value: K;
  onChange: (k: K) => void;
  /** unique per page so the indicator animates only within its own bar */
  id: string;
  sticky?: boolean;
  top?: string;
}

/** FotMob-style text tabs with a sliding underline, on a blurred sticky bar. */
export default function UnderlineTabs<K extends string>({ tabs, value, onChange, id, sticky = true, top }: Props<K>) {
  return (
    <div
      className={`${sticky ? "sticky z-20" : ""} border-b border-white/[0.07] bg-background/85 backdrop-blur-xl`}
      style={sticky ? { top } : undefined}
      role="tablist"
    >
      <div className="no-scrollbar flex overflow-x-auto px-2">
        {tabs.map(([k, label]) => {
          const on = k === value;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(k)}
              className={`relative min-w-[4.5rem] flex-1 shrink-0 whitespace-nowrap px-3 pb-3 pt-3 text-[14px] font-bold transition-colors ${on ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
            >
              {label}
              {on && (
                <motion.span
                  layoutId={`ul-${id}`}
                  className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
