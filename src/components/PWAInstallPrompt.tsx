import { useState, useEffect } from "react";
import { X, Download, Share, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PromptMode = "none" | "android" | "ios-safari" | "ios-inapp";

/**
 * Detect if running inside an in-app browser (KakaoTalk, Naver, Instagram, Facebook, Line, etc.)
 */
const detectInAppBrowser = (ua: string): boolean => {
  const inAppPatterns = [
    /KAKAOTALK/i,
    /NAVER/i,
    /Instagram/i,
    /FBAN|FBAV/i, // Facebook
    /Line\//i,
    /DaumApps/i,
    /SamsungBrowser\/.*CrossApp/i,
    /Twitter/i,
    /Snapchat/i,
  ];
  return inAppPatterns.some((p) => p.test(ua));
};

const detectIOS = (ua: string): boolean => {
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isStandaloneMode = (): boolean => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
};

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<PromptMode>("none");
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed → do nothing
    if (isStandaloneMode()) return;

    // Respect 24h dismiss
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent;
    const isiOS = detectIOS(ua);
    const isInApp = detectInAppBrowser(ua);

    if (isiOS && isInApp) {
      // iOS in-app browser → guide to Safari
      setMode("ios-inapp");
      setVisible(true);
      return;
    }

    if (isiOS) {
      // iOS Safari → show "Add to Home Screen" guide
      setMode("ios-safari");
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }

    // Android / Desktop → listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("android");
      setTimeout(() => setVisible(true), 1500);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  };

  if (dismissed || !visible) return null;

  /* ───────────────────────── iOS In-App Browser (Full-screen overlay) ───────────────────────── */
  if (mode === "ios-inapp") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl p-6"
        >
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={22} />
          </button>

          <div className="flex flex-col items-center gap-6 max-w-sm text-center">
            <img
              src="/pwa-icon-192.png"
              alt="Bunnies FC"
              className="h-20 w-20 rounded-2xl"
            />

            <div>
              <h2 className="font-display text-xl text-primary text-glow tracking-wide mb-2">
                ⚠️ Safari로 열기가 필요합니다
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                현재 인앱 브라우저에서는 앱을 설치할 수 없어요.
                <br />
                아래 버튼을 눌러 <span className="text-foreground font-semibold">Safari</span>에서
                열어주세요!
              </p>
            </div>

            {/* Visual guide pointing to the Safari/compass icon */}
            <div className="relative w-full rounded-2xl border border-border bg-secondary/50 p-5">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                  <ExternalLink size={24} className="text-primary" />
                </div>
              </div>

              <p className="text-sm text-foreground font-medium mb-1">
                Safari로 여는 방법
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                화면 우측 하단(또는 상단)의{" "}
                <span className="text-primary font-bold">⋯</span> 메뉴 →{" "}
                <span className="text-foreground font-semibold">
                  "Safari로 열기"
                </span>{" "}
                또는{" "}
                <span className="text-foreground font-semibold">
                  "기본 브라우저로 열기"
                </span>
                를 탭하세요.
              </p>

              {/* Animated arrow pointing down-right */}
              <motion.div
                className="absolute -bottom-8 right-6 text-primary"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </motion.div>
            </div>

            <button
              onClick={handleDismiss}
              className="mt-4 w-full rounded-xl bg-secondary py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/80"
            >
              나중에 할게요
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  /* ───────────────────────── iOS Safari Guide (Bottom sheet) ───────────────────────── */
  if (mode === "ios-safari") {
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
            <img
              src="/pwa-icon-192.png"
              alt="Bunnies FC"
              className="h-12 w-12 rounded-xl"
            />
            <div>
              <h3 className="font-display text-lg text-primary text-glow tracking-wide">
                BUNNIES FC
              </h3>
              <p className="text-[11px] text-muted-foreground">공식 풋살 앱</p>
            </div>
          </div>

          <p className="text-sm text-foreground mb-3">
            이 앱을 홈 화면에 추가하고 편하게 사용하세요!
          </p>

          <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                1
              </span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                하단의{" "}
                <Share size={16} className="text-primary inline" />{" "}
                <span className="text-foreground font-medium">공유</span> 버튼
                탭
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                2
              </span>
              <span className="text-sm text-muted-foreground">
                아래로 스크롤 →{" "}
                <span className="text-foreground font-medium">
                  '홈 화면에 추가'
                </span>{" "}
                선택
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                3
              </span>
              <span className="text-sm text-muted-foreground">
                오른쪽 상단{" "}
                <span className="text-foreground font-medium">'추가'</span> 탭
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="mt-3 w-full rounded-xl bg-secondary py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/80"
          >
            알겠어요
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  /* ───────────────────────── Android / Desktop (Floating install button) ───────────────────────── */
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
          <img
            src="/pwa-icon-192.png"
            alt="Bunnies FC"
            className="h-12 w-12 rounded-xl"
          />
          <div>
            <h3 className="font-display text-lg text-primary text-glow tracking-wide">
              BUNNIES FC
            </h3>
            <p className="text-[11px] text-muted-foreground">공식 풋살 앱</p>
          </div>
        </div>

        <p className="text-sm text-foreground mb-3">
          이 앱을 홈 화면에 추가하고 편하게 사용하세요!
        </p>

        <button
          onClick={handleInstall}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
        >
          <Download size={18} />
          우리 앱 설치하기
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
