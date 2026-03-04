import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if previously dismissed (respect for 24h)
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    if (isiOS) {
      // Show iOS guide after a short delay
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  };

  if (isStandalone || dismissed || !showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-primary/10"
      >
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <img src="/pwa-icon-192.png" alt="Bunnies FC" className="h-12 w-12 rounded-xl" />
          <div>
            <h3 className="font-display text-lg text-primary text-glow tracking-wide">BUNNIES FC</h3>
            <p className="text-[11px] text-muted-foreground">공식 풋살 앱</p>
          </div>
        </div>

        {isIOS ? (
          /* iOS Guide */
          <div>
            <p className="text-sm text-foreground mb-3">
              이 앱을 홈 화면에 추가하고 편하게 사용하세요!
            </p>
            <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  하단의 <Share size={16} className="text-primary inline" /> <span className="text-foreground font-medium">공유</span> 버튼 탭
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
                <span className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">'홈 화면에 추가'</span> 선택
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">3</span>
                <span className="text-sm text-muted-foreground">
                  오른쪽 상단 <span className="text-foreground font-medium">'추가'</span> 탭
                </span>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="mt-3 w-full rounded-xl bg-secondary py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/80"
            >
              알겠어요
            </button>
          </div>
        ) : (
          /* Android / Desktop */
          <div>
            <p className="text-sm text-foreground mb-3">
              이 앱을 홈 화면에 추가하고 편하게 사용하세요!
            </p>
            <button
              onClick={handleInstall}
              className="w-full rounded-xl gradient-pink py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
            >
              <Download size={18} />
              설치하기
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
