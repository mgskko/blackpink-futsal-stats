/** FotMob-style rating chip: green ≥7, teal ≥6.5, amber ≥6, red below; dash when no rating. */
export function ratingColor(v: number) {
  if (!v) return "bg-muted text-muted-foreground";
  if (v >= 8) return "bg-[#1a7dff] text-white";
  if (v >= 7) return "bg-emerald-500 text-white";
  if (v >= 6.5) return "bg-lime-500 text-black";
  if (v >= 6) return "bg-amber-400 text-black";
  return "bg-red-500 text-white";
}

export default function RatingBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-9 min-w-12 text-lg" : size === "sm" ? "h-5 min-w-8 text-[11px]" : "h-7 min-w-10 text-sm";
  return (
    <span className={`inline-flex items-center justify-center rounded-lg px-1.5 font-num font-extrabold ${cls} ${ratingColor(value)}`}>
      {value ? value.toFixed(1) : "–"}
    </span>
  );
}
