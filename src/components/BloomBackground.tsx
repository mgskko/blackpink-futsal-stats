/**
 * Apple-style soft bloom background. Renders fixed, behind all content.
 * Color blobs adapt automatically via Tailwind dark/light variants.
 */
const BloomBackground = () => (
  <div
    aria-hidden
    className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
  >
    <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pink-500/20 blur-[120px] dark:bg-pink-600/20" />
    <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-purple-500/15 blur-[100px] dark:bg-purple-600/15" />
    <div className="absolute -bottom-32 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[130px] dark:bg-blue-600/10" />
  </div>
);

export default BloomBackground;