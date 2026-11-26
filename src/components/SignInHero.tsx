import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { lovable } from "@/integrations/lovable/index";
import LazyBall3D from "@/components/fx/LazyBall3D";

/** Signed-out hero: club records are members-only, so invite a sign-in. */
export default function SignInHero({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);

  const signIn = () => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative z-10 flex flex-col items-center px-6 text-center ${compact ? "py-8" : "min-h-[78vh] justify-center"}`}
    >
      <div className="relative">
        <div className="absolute inset-4 rounded-full bg-primary/35 blur-3xl" aria-hidden />
        <LazyBall3D size={compact ? 140 : 190} spin={0.7} />
      </div>
      <div className="-mt-1 h-3 w-28 rounded-[50%] bg-black/50 blur-md" aria-hidden />
      <h1 className="mt-6 font-display text-5xl tracking-[0.12em] text-gradient">BUNNIES FC</h1>
      <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
        {L("경기 기록 · 선수 스탯 · 전술 분석은 멤버 전용이에요. 로그인하고 우리 팀의 모든 순간을 확인하세요.",
          "Match logs, player stats and tactics are members-only. Sign in to follow every moment of the club.")}
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={signIn}
        className="mt-7 flex w-full max-w-xs items-center justify-center gap-2.5 rounded-full bg-white py-3.5 text-[15px] font-bold text-neutral-900 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.8)]"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {L("Google로 계속하기", "Continue with Google")}
      </motion.button>
    </motion.section>
  );
}
