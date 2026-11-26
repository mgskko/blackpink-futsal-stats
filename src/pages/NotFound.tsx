import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LazyBall3D from "@/components/fx/LazyBall3D";

const NotFound = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? "ko").startsWith("en");
  return (
    <div className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center px-8 text-center">
      <LazyBall3D size={120} spin={2.4} />
      <h1 className="mt-6 font-display text-7xl tracking-wider text-gradient">404</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isEn ? "Wide of the post — this page doesn't exist." : "골대를 빗나갔어요 — 없는 페이지입니다."}
      </p>
      <button onClick={() => navigate("/")} className="gradient-pink pressable mt-6 rounded-full px-6 py-2.5 text-sm font-bold text-primary-foreground">
        {isEn ? "Back to matches" : "경기 목록으로"}
      </button>
    </div>
  );
};

export default NotFound;
