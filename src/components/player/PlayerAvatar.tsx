import type { Player } from "@/hooks/useFutsalData";

/** Round photo with kit-number chip; falls back to the number (or initial) on a gradient. */
export default function PlayerAvatar({ player, size = 40, ring = false }: { player: Pick<Player, "name" | "profile_image_url" | "back_number">; size?: number; ring?: boolean }) {
  const n = player.back_number;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className={`h-full w-full overflow-hidden rounded-full bg-gradient-to-b from-secondary to-muted ${ring ? "ring-2 ring-primary/60" : "ring-1 ring-white/10"}`}>
        {player.profile_image_url ? (
          <img src={player.profile_image_url} alt={player.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-num font-extrabold text-foreground/70" style={{ fontSize: size * 0.36 }}>
            {n ?? player.name.charAt(0)}
          </span>
        )}
      </div>
      {player.profile_image_url && n != null && (
        <span className="absolute -bottom-0.5 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-background px-1 font-num text-[10px] font-extrabold ring-1 ring-border">
          {n}
        </span>
      )}
    </div>
  );
}
