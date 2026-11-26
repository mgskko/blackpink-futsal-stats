import { motion } from "framer-motion";
import LazyBall3D from "@/components/fx/LazyBall3D";

/** Full-screen loading state: floating 3D match ball over a light pool. */
const SplashScreen = () => (
  <div className="relative z-10 flex min-h-[85vh] items-center justify-center" role="status" aria-label="Loading">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <LazyBall3D size={150} spin={1.6} interactive={false} />
      </div>
      {/* contact shadow */}
      <motion.div
        aria-hidden
        className="-mt-2 h-3 w-24 rounded-[50%] bg-black/50 blur-md dark:bg-black/80"
        animate={{ scaleX: [1, 0.85, 1], opacity: [0.7, 0.45, 0.7] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-6 font-display text-3xl tracking-[0.2em] text-gradient"
      >
        BUNNIES FC
      </motion.p>
      <div className="mt-3 h-0.5 w-28 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full w-1/2 rounded-full gradient-pink"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  </div>
);

export default SplashScreen;
