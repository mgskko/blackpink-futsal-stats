import { ratingTone } from "@/lib/matchRating";

/** FotMob bands: blue ≥8, green ≥7, lime ≥6.5, amber ≥6, red below; dash when no rating. */
export const ratingColor = ratingTone;

export default function RatingBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-9 min-w-12 text-lg" : size === "sm" ? "h-5 min-w-8 text-[11px]" : "h-7 min-w-10 text-sm";
  return (
    <span className={`inline-flex items-center justify-center rounded-lg px-1.5 font-num font-extrabold ${cls} ${ratingColor(value)}`}>
      {value ? value.toFixed(1) : "–"}
    </span>
  );
}
