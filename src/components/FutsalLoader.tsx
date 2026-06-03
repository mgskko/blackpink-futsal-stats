import { motion } from "framer-motion";

interface FutsalLoaderProps {
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Liquid-glass futsal ball loader.
 * Replaces skeleton loaders for hero / data-fetch states.
 * Breathing pulse via framer-motion (1s loop).
 */
const FutsalLoader = ({ size = 72, label, className = "" }: FutsalLoaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size * 1.6, height: size * 1.6 }}>
        {/* Glass Glow halo */}
        <motion.div
          className="absolute inset-0 rounded-full glass-glow"
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Futsal ball with liquid-glass effect */}
        <motion.div
          className="relative rounded-full liquid-glass flex items-center justify-center overflow-hidden"
          style={{ width: size, height: size }}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 64 64" className="w-[78%] h-[78%] drop-shadow" fill="none">
            <circle cx="32" cy="32" r="30" fill="hsl(var(--background) / 0.4)" stroke="hsl(var(--foreground) / 0.4)" strokeWidth="1.5" />
            {/* Pentagon (center) */}
            <polygon
              points="32,18 42,25 38,37 26,37 22,25"
              fill="hsl(var(--foreground) / 0.85)"
              stroke="hsl(var(--foreground))"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Surrounding panel lines */}
            <path d="M32 18 L32 6" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.2" />
            <path d="M42 25 L54 22" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.2" />
            <path d="M38 37 L46 48" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.2" />
            <path d="M26 37 L18 48" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.2" />
            <path d="M22 25 L10 22" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.2" />
          </svg>
          {/* Specular highlight overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, hsl(0 0% 100% / 0.45) 0%, transparent 35%)",
            }}
          />
        </motion.div>
      </div>
      {label && (
        <motion.p
          className="text-sm text-muted-foreground tracking-wide"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.p>
      )}
    </motion.div>
  );
};

export default FutsalLoader;