import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Newspaper, Shirt, Shield, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useGuideSections } from "@/data/guideSections";
import { useTranslation } from "react-i18next";

interface HistoryItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  year: number | null;
  image_url: string | null;
  sort_order: number | null;
}

const ClubhousePage = () => {
  const [activeSection, setActiveSection] = useState<"guide" | "history">("guide");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const { i18n } = useTranslation();
  const isEn = (i18n.language ?? i18n.resolvedLanguage ?? "ko").startsWith("en");
  const L = (ko: string, en: string) => (isEn ? en : ko);
  const GUIDE_SECTIONS = useGuideSections();

  const { data: historyItems = [] } = useQuery({
    queryKey: ["team_history"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("team_history").select("*").order("sort_order", { ascending: true });
      return (data ?? []) as HistoryItem[];
    },
  });

  const logos = historyItems.filter(i => i.category === "logo");
  const uniforms = historyItems.filter(i => i.category === "uniform");
  const milestones = historyItems.filter(i => i.category === "milestone");

  return (
    <div className="pb-20">
          <PageHeader title="CLUBHOUSE" subtitle={L("버니즈 클럽하우스", "Bunnies Clubhouse")} />
      <div className="px-4">
        {/* Section switcher */}
        <div className="flex rounded-lg border border-border bg-card overflow-hidden mb-6">
          <button onClick={() => setActiveSection("guide")}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${activeSection === "guide" ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            📖 {L("가이드", "Guide")}
          </button>
          <button onClick={() => setActiveSection("history")}
            className={`flex-1 py-2.5 text-xs font-bold transition-all ${activeSection === "history" ? "gradient-pink text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            🏛️ {L("구단 역사", "Club History")}
          </button>
        </div>

        {activeSection === "guide" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                <Book size={16} /> {L("앱에서 사용되는 모든 용어와 기준을 설명합니다", "Every term and metric used across the app.")}
              </div>
              <p className="text-xs text-muted-foreground">{L("각 항목을 탭하면 상세 설명을 확인할 수 있습니다.", "Tap each item to expand the full description.")}</p>
            </div>

            {GUIDE_SECTIONS.map((section, si) => (
              <motion.div key={si} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.03 }} className="mb-4">
                <h2 className="font-display text-lg tracking-wider text-primary mb-2">{section.title}</h2>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Accordion type="multiple">
                    {section.items.map((item, ii) => (
                      <AccordionItem key={ii} value={`${si}-${ii}`} className="border-b border-border last:border-b-0">
                        <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline">{item.term}</AccordionTrigger>
                        <AccordionContent className="px-4 text-xs text-muted-foreground leading-relaxed">{item.desc}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeSection === "history" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {historyItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Shield size={48} className="mb-3 opacity-30" />
                <p className="text-sm">{L("아직 등록된 구단 역사가 없습니다", "No club history entries yet.")}</p>
                <p className="text-xs mt-1">{L("관리자가 클럽하우스 컨텐츠를 추가할 수 있습니다", "Admins can add clubhouse content.")}</p>
              </div>
            )}

            {/* Emblems */}
            {logos.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
                  <Shield size={18} /> {L("엠블럼 변천사", "Emblem Evolution")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {logos.map(item => (
                    <motion.div key={item.id} whileHover={{ scale: 1.02 }}
                      className="rounded-xl border border-border bg-card overflow-hidden">
                      {item.image_url && (
                        <div className="aspect-square bg-secondary/30 flex items-center justify-center p-4 cursor-pointer"
                          onClick={() => setLightboxUrl(item.image_url)}>
                          <img src={item.image_url} alt={item.title} className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div className="p-3">
                        <div className="text-sm font-bold text-foreground">{item.title}</div>
                        {item.year && <div className="text-[10px] text-primary font-bold">{item.year}년</div>}
                        {item.description && <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Uniforms */}
            {uniforms.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
                  <Shirt size={18} /> {L("유니폼 컬렉션", "Kit Collection")}
                </h3>
                <div className="space-y-3">
                  {uniforms.map(item => (
                    <motion.div key={item.id} whileHover={{ scale: 1.01 }}
                      className="flex rounded-xl border border-border bg-card overflow-hidden">
                      {item.image_url && (
                        <div className="w-28 h-28 flex-shrink-0 bg-secondary/30 flex items-center justify-center p-2 cursor-pointer"
                          onClick={() => setLightboxUrl(item.image_url)}>
                          <img src={item.image_url} alt={item.title} className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div className="p-3 flex-1">
                        <div className="text-sm font-bold text-foreground">{item.title}</div>
                        {item.year && <div className="text-[10px] text-primary font-bold">{item.year}년</div>}
                        {item.description && <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 보도자료 (formerly Milestones/Trophies) */}
            {milestones.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wider text-primary">
                  <Newspaper size={18} /> {L("보도자료", "Press")}
                </h3>
                <div className="space-y-3">
                  {milestones.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-card p-4">
                      <div className="flex items-start gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer"
                            onClick={() => setLightboxUrl(item.image_url)} />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Newspaper size={20} className="text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-foreground">{item.title}</div>
                          {item.year && <div className="text-[10px] text-primary font-bold">{item.year}년</div>}
                          {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.25 }}
              src={lightboxUrl}
              alt="확대 이미지"
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClubhousePage;
