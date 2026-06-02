import { useTranslation } from "react-i18next";

const LanguageToggle = () => {
  const { i18n, t } = useTranslation();
  const lang = (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en") ? "en" : "ko";

  const set = (next: "ko" | "en") => {
    void i18n.changeLanguage(next);
  };

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur-xl dark:border-white/10"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => set("ko")}
        aria-label={t("language.switchToKR")}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
          lang === "ko"
            ? "bg-white/15 text-foreground shadow-inner"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        KR
      </button>
      <button
        type="button"
        onClick={() => set("en")}
        aria-label={t("language.switchToEN")}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
          lang === "en"
            ? "bg-white/15 text-foreground shadow-inner"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageToggle;