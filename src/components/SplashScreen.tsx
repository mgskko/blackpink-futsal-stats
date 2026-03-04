import { motion } from "framer-motion";
import burneesLogo from "@/assets/burnees-logo.png";

const SplashScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6"
    >
      <motion.img
        src={burneesLogo}
        alt="Burnees FC"
        className="h-32 w-32 rounded-full"
        animate={{ 
          boxShadow: [
            "0 0 20px hsl(330 100% 71% / 0.3)",
            "0 0 40px hsl(330 100% 71% / 0.6)",
            "0 0 20px hsl(330 100% 71% / 0.3)",
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="font-display text-2xl tracking-wider text-glow text-primary"
      >
        BURNEES FC
      </motion.p>
    </motion.div>
  </div>
);

export default SplashScreen;
