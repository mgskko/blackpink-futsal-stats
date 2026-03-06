import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Edit, Trash2, Save, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface TacticDB {
  id: string;
  title: string;
  subtitle: string | null;
  formation: string | null;
  summary: string | null;
  roles: { number: string; role: string }[];
  steps: { phase: string; detail: string }[];
  warnings: string[];
  sort_order: number | null;
}

const TacticsPage = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formFormation, setFormFormation] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formRoles, setFormRoles] = useState<{ number: string; role: string }[]>([]);
  const [formSteps, setFormSteps] = useState<{ phase: string; detail: string }[]>([]);
  const [formWarnings, setFormWarnings] = useState<string[]>([]);

  const { data: tactics = [], isLoading } = useQuery({
    queryKey: ["tactics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tactics").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        roles: Array.isArray(t.roles) ? t.roles : [],
        steps: Array.isArray(t.steps) ? t.steps : [],
        warnings: Array.isArray(t.warnings) ? t.warnings : [],
      })) as TacticDB[];
    },
  });

  const resetForm = () => {
    setFormTitle(""); setFormSubtitle(""); setFormFormation(""); setFormSummary("");
    setFormRoles([]); setFormSteps([]); setFormWarnings([]);
  };

  const loadForm = (t: TacticDB) => {
    setFormTitle(t.title); setFormSubtitle(t.subtitle || ""); setFormFormation(t.formation || "");
    setFormSummary(t.summary || ""); setFormRoles([...t.roles]); setFormSteps([...t.steps]); setFormWarnings([...t.warnings]);
  };

  const handleSave = async (id?: string) => {
    if (!formTitle.trim()) { toast({ title: "전술 이름을 입력하세요", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        title: formTitle, subtitle: formSubtitle || null, formation: formFormation || null,
        summary: formSummary || null, roles: formRoles, steps: formSteps, warnings: formWarnings,
      };
      if (id) {
        const { error } = await supabase.from("tactics").update(payload).eq("id", id);
        if (error) throw error;
        toast({ title: "전술이 수정되었습니다 ✅" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("tactics").insert({ ...payload, created_by: user?.id, sort_order: tactics.length });
        if (error) throw error;
        toast({ title: "전술이 추가되었습니다 ✅" });
      }
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      setEditing(null); setCreating(false); resetForm();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("tactics").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      toast({ title: "전술이 삭제되었습니다" });
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const TacticForm = ({ id }: { id?: string }) => (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">전술 이름 *</label>
          <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="예: 블라인드 & 우당탕탕" className="h-8 text-xs bg-background border-border" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">부제목</label>
          <Input value={formSubtitle} onChange={e => setFormSubtitle(e.target.value)} placeholder="영어명" className="h-8 text-xs bg-background border-border" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">포메이션</label>
        <Input value={formFormation} onChange={e => setFormFormation(e.target.value)} placeholder="예: 2-1-2" className="h-8 text-xs bg-background border-border" />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">요약</label>
        <Textarea value={formSummary} onChange={e => setFormSummary(e.target.value)} placeholder="전술 요약 설명" className="text-xs bg-background border-border min-h-[60px]" />
      </div>

      {/* Roles */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground font-bold">역할 분담</label>
          <button type="button" onClick={() => setFormRoles([...formRoles, { number: "", role: "" }])} className="text-[10px] text-primary">+ 추가</button>
        </div>
        {formRoles.map((r, i) => (
          <div key={i} className="flex gap-1 mt-1">
            <Input value={r.number} onChange={e => { const n = [...formRoles]; n[i].number = e.target.value; setFormRoles(n); }} placeholder="번호" className="h-7 text-xs bg-background border-border w-16" />
            <Input value={r.role} onChange={e => { const n = [...formRoles]; n[i].role = e.target.value; setFormRoles(n); }} placeholder="역할" className="h-7 text-xs bg-background border-border flex-1" />
            <button type="button" onClick={() => setFormRoles(formRoles.filter((_, j) => j !== i))} className="text-destructive"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground font-bold">단계별 실행</label>
          <button type="button" onClick={() => setFormSteps([...formSteps, { phase: "", detail: "" }])} className="text-[10px] text-primary">+ 추가</button>
        </div>
        {formSteps.map((s, i) => (
          <div key={i} className="flex gap-1 mt-1">
            <Input value={s.phase} onChange={e => { const n = [...formSteps]; n[i].phase = e.target.value; setFormSteps(n); }} placeholder="단계" className="h-7 text-xs bg-background border-border w-24" />
            <Input value={s.detail} onChange={e => { const n = [...formSteps]; n[i].detail = e.target.value; setFormSteps(n); }} placeholder="설명" className="h-7 text-xs bg-background border-border flex-1" />
            <button type="button" onClick={() => setFormSteps(formSteps.filter((_, j) => j !== i))} className="text-destructive"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      {/* Warnings */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground font-bold">주의사항</label>
          <button type="button" onClick={() => setFormWarnings([...formWarnings, ""])} className="text-[10px] text-primary">+ 추가</button>
        </div>
        {formWarnings.map((w, i) => (
          <div key={i} className="flex gap-1 mt-1">
            <Input value={w} onChange={e => { const n = [...formWarnings]; n[i] = e.target.value; setFormWarnings(n); }} placeholder="주의사항" className="h-7 text-xs bg-background border-border flex-1" />
            <button type="button" onClick={() => setFormWarnings(formWarnings.filter((_, j) => j !== i))} className="text-destructive"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleSave(id)} disabled={saving} className="flex-1 h-8 text-xs gradient-pink text-primary-foreground">
          <Save size={12} /> {saving ? "저장 중..." : "저장"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setEditing(null); setCreating(false); resetForm(); }} className="h-8 text-xs border-border">
          <X size={12} /> 취소
        </Button>
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <PageHeader title="TACTICS" subtitle="감독의 작전판" />

      <div className="px-4 space-y-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-primary font-bold mb-1">📋 전술 보드</p>
          <p className="text-xs text-muted-foreground">각 전술 카드를 탭하면 상세 내용을 확인할 수 있습니다.</p>
        </div>

        {isAdmin && !creating && !editing && (
          <Button size="sm" variant="outline" onClick={() => { setCreating(true); resetForm(); }} className="w-full h-8 text-xs border-primary/30 text-primary">
            <Plus size={14} /> 새 전술 추가
          </Button>
        )}

        {creating && <TacticForm />}

        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">로딩 중...</div>
        ) : tactics.length === 0 && !creating ? (
          <div className="text-center text-sm text-muted-foreground py-8">등록된 전술이 없습니다</div>
        ) : (
          tactics.map((tactic, i) => (
            <motion.div key={tactic.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              {editing === tactic.id ? (
                <TacticForm id={tactic.id} />
              ) : (
                <>
                  <div
                    onClick={() => setExpanded(expanded === tactic.id ? null : tactic.id)}
                    className="cursor-pointer rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground">{tactic.formation || `전술 ${i + 1}`}</span>
                        </div>
                        <h3 className="font-display text-lg tracking-wide text-foreground">{tactic.title}</h3>
                        {tactic.subtitle && <p className="text-[10px] text-muted-foreground italic">{tactic.subtitle}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <button onClick={e => { e.stopPropagation(); loadForm(tactic); setEditing(tactic.id); }} className="text-primary hover:text-primary/80"><Edit size={14} /></button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(tactic.id); }} className="text-destructive hover:text-destructive/80"><Trash2 size={14} /></button>
                          </>
                        )}
                        {expanded === tactic.id ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
                      </div>
                    </div>
                    {tactic.summary && <p className="mt-3 text-sm text-muted-foreground">{tactic.summary}</p>}
                  </div>

                  <AnimatePresence>
                    {expanded === tactic.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-2 rounded-xl border border-border bg-card p-5 space-y-5">
                          {tactic.roles.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-primary mb-2">👥 역할 분담</h4>
                              <div className="space-y-1.5">
                                {tactic.roles.map((r: any, ri: number) => (
                                  <div key={ri} className="flex items-center gap-2">
                                    <span className="flex h-6 min-w-[40px] items-center justify-center rounded-md bg-primary/20 text-[10px] font-bold text-primary">{r.number}</span>
                                    <span className="text-xs text-foreground">{r.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {tactic.steps.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-primary mb-2">📍 단계별 실행</h4>
                              <div className="space-y-3">
                                {tactic.steps.map((step: any, si: number) => (
                                  <div key={si} className="rounded-lg bg-secondary/30 border border-border/50 p-3">
                                    <div className="text-xs font-bold text-foreground mb-1">{step.phase}</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {tactic.warnings.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-destructive mb-2">⚠️ 주의사항</h4>
                              <div className="space-y-1.5">
                                {tactic.warnings.map((w: any, wi: number) => (
                                  <div key={wi} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <span className="text-destructive mt-0.5">•</span>
                                    <span>{w}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default TacticsPage;
