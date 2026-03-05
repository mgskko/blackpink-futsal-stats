import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AvatarModalProps {
  imageUrl: string | null;
  name: string;
  open: boolean;
  onClose: () => void;
}

const AvatarModal = ({ imageUrl, name, open, onClose }: AvatarModalProps) => {
  if (!imageUrl) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          <button onClick={onClose} className="absolute top-4 right-4 rounded-full bg-muted/30 p-2 text-foreground hover:bg-muted/50 transition-colors z-10">
            <X size={24} />
          </button>
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            src={imageUrl}
            alt={name}
            className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AvatarModal;
