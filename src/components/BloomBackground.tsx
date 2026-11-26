/**
 * Ambient stadium-night backdrop: drifting colour blooms, a faint pitch-line
 * motif and film grain. Fixed behind all content; transform-only animation.
 */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const BloomBackground = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 mx-auto max-w-lg overflow-hidden">
    <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] animate-[bloom-a_22s_ease-in-out_infinite] rounded-full bg-pink-500/25 blur-[120px] dark:bg-pink-600/25" />
    <div className="absolute -right-40 top-1/3 h-96 w-96 animate-[bloom-b_26s_ease-in-out_infinite] rounded-full bg-violet-500/20 blur-[110px] dark:bg-violet-600/20" />
    <div className="absolute -bottom-40 left-1/4 h-80 w-[70%] animate-[bloom-a_30s_ease-in-out_infinite_reverse] rounded-full bg-sky-500/10 blur-[130px] dark:bg-blue-600/15" />
    {/* centre circle motif */}
    <svg className="absolute left-1/2 top-[18%] h-[34rem] w-[34rem] -translate-x-1/2 text-foreground opacity-[0.035]" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.6">
      <circle cx="100" cy="100" r="60" />
      <circle cx="100" cy="100" r="1.6" fill="currentColor" />
      <line x1="0" y1="100" x2="200" y2="100" />
    </svg>
    <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    <style>{`
      @keyframes bloom-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(40px,60px,0) scale(1.12); } }
      @keyframes bloom-b { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-50px,-40px,0) scale(0.9); } }
    `}</style>
  </div>
);

export default BloomBackground;
