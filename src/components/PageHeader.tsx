import { motion } from "framer-motion";
import burneesLogo from "@/assets/burnees-logo.png";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

const PageHeader = ({ title, subtitle }: PageHeaderProps) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="px-4 pt-6 pb-4"
  >
    <div className="flex items-center gap-3">
      <img src={burneesLogo} alt="Bunnies FC" className="h-10 w-10 rounded-full" />
      <div>
        <h1 className="font-display text-3xl tracking-wider text-glow text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
    <div className="mt-3 neon-line" />
  </motion.div>
);

export default PageHeader;
