import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Crosshair, Zap, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface Tactic {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  summary: string;
  roles: { number: string; role: string }[];
  steps: { phase: string; detail: string }[];
  warnings: string[];
}

const tactics: Tactic[] = [
  {
    id: "blind-chaos",
    title: "블라인드 & 우당탕탕",
    subtitle: "Blind & Chaos",
    icon: <Zap size={20} />,
    color: "from-red-500/20 to-orange-500/10",
    borderColor: "border-red-500/40",
    summary: "골키퍼 시야 차단 및 빠르고 낮은 패스를 통한 골문 앞 혼전 유도",
    roles: [
      { number: "7번", role: "빠르고 강한 땅볼 킥 (키커)" },
      { number: "10번", role: "골키퍼 스크린 및 혼전 유도" },
      { number: "8번/11번", role: "세컨볼 쇄도 타격" },
      { number: "9번", role: "수비 밸런스 유지" },
    ],
    steps: [
      { phase: "🏗️ Setup", detail: "10번이 골키퍼 앞에 위치하여 시야를 차단. 8번/11번은 페널티 박스 안에서 대기. 9번은 후방 수비." },
      { phase: "⚡ Execute", detail: "7번이 빠르고 낮은 땅볼을 골문 앞으로 투입. 10번이 몸을 이용해 GK 시야를 지속 차단." },
      { phase: "🎯 Finish", detail: "8번/11번이 세컨볼에 쇄도하여 마무리 슈팅. 혼전 상황에서 터치 하나로 골 연결." },
    ],
    warnings: ["패스 스피드가 느리면 수비에 걸림 → 반드시 강하고 빠른 땅볼", "10번 스크린 시 파울 주의 (팔꿈치, 밀치기 금지)", "역습 대비: 9번은 반드시 백코트 유지"],
  },
  {
    id: "backfield-strike",
    title: "후방 대포알",
    subtitle: "Backfield Strike",
    icon: <Target size={20} />,
    color: "from-blue-500/20 to-cyan-500/10",
    borderColor: "border-blue-500/40",
    summary: "키커가 맨 후방의 9번에게 낮고 빠르게 깔아주고, 9번이 논스톱 슈팅으로 마무리",
    roles: [
      { number: "7번", role: "키커 — 후방으로 낮고 빠른 패스" },
      { number: "9번", role: "맨 후방 대기 → 논스톱 슈팅" },
      { number: "나머지", role: "페널티 박스 안에서 디코이 런" },
    ],
    steps: [
      { phase: "🏗️ Setup", detail: "9번이 페널티 박스 밖 맨 후방에 단독 대기. 나머지 공격수들은 박스 안에서 움직이며 주의를 분산." },
      { phase: "⚡ Execute", detail: "7번이 코너킥을 9번에게 낮고 빠르게 깔아줌. 상대 수비는 박스 안에 집중." },
      { phase: "🎯 Finish", detail: "9번이 트래핑 없이 원터치 논스톱 슈팅. 키퍼가 준비 안 된 사이 강슛." },
    ],
    warnings: ["9번의 슈팅 정확도가 핵심 — 미리 슈팅 연습 필수", "패스가 뜨면 실패 → 반드시 낮은 볼", "상대가 후방을 마크하면 박스 안 공격으로 전환"],
  },
  {
    id: "short-space",
    title: "숏패스 공간 창출",
    subtitle: "Short 1-2 Space Creation",
    icon: <Crosshair size={20} />,
    color: "from-green-500/20 to-emerald-500/10",
    borderColor: "border-green-500/40",
    summary: "키커와 가까운 선수가 숏패스로 2대1을 만들어 상대를 끌어내고 컷백 공간 창출",
    roles: [
      { number: "7번", role: "키커 — 11번과 숏패스 주고받기" },
      { number: "11번", role: "가장 가까이 위치 → 원투 패스 파트너" },
      { number: "나머지", role: "니어/파 포스트에서 마무리 대기" },
    ],
    steps: [
      { phase: "🏗️ Setup", detail: "11번이 코너 플래그 근처에서 7번과 가까이 위치. 나머지는 박스 안 니어/파 포스트로 산개." },
      { phase: "⚡ Execute", detail: "7번이 11번에게 짧은 패스 → 11번이 리턴 패스 → 수비가 끌려나옴." },
      { phase: "🎯 Finish", detail: "7번(또는 11번)이 열린 공간으로 컷백 크로스. 박스 안 공격수가 마무리." },
    ],
    warnings: ["숏패스가 인터셉트되면 역습 위험 → 빠른 패스 교환 필수", "상대가 안 나오면 무리하지 말고 직접 크로스로 전환", "11번이 리턴 패스 후 즉시 달려야 공간이 생김"],
  },
];

const TacticsPage = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="pb-20">
      <PageHeader title="TACTICS" subtitle="감독의 작전판" />

      <div className="px-4 space-y-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-primary font-bold mb-1">📋 코너킥 전술 보드</p>
          <p className="text-xs text-muted-foreground">각 전술 카드를 탭하면 상세 내용을 확인할 수 있습니다.</p>
        </div>

        {tactics.map((tactic, i) => (
          <motion.div
            key={tactic.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div
              onClick={() => setExpanded(expanded === tactic.id ? null : tactic.id)}
              className={`cursor-pointer rounded-xl border ${tactic.borderColor} bg-gradient-to-br ${tactic.color} p-5 transition-all hover:shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card border border-border">
                    {tactic.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground">코너킥 {i + 1}</span>
                    </div>
                    <h3 className="font-display text-lg tracking-wide text-foreground">{tactic.title}</h3>
                    <p className="text-[10px] text-muted-foreground italic">{tactic.subtitle}</p>
                  </div>
                </div>
                {expanded === tactic.id ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{tactic.summary}</p>
            </div>

            <AnimatePresence>
              {expanded === tactic.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-xl border border-border bg-card p-5 space-y-5">
                    {/* Roles */}
                    <div>
                      <h4 className="text-xs font-bold text-primary mb-2">👥 역할 분담</h4>
                      <div className="space-y-1.5">
                        {tactic.roles.map((r) => (
                          <div key={r.number} className="flex items-center gap-2">
                            <span className="flex h-6 min-w-[40px] items-center justify-center rounded-md bg-primary/20 text-[10px] font-bold text-primary">{r.number}</span>
                            <span className="text-xs text-foreground">{r.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Steps */}
                    <div>
                      <h4 className="text-xs font-bold text-primary mb-2">📍 단계별 실행</h4>
                      <div className="space-y-3">
                        {tactic.steps.map((step) => (
                          <div key={step.phase} className="rounded-lg bg-secondary/30 border border-border/50 p-3">
                            <div className="text-xs font-bold text-foreground mb-1">{step.phase}</div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warnings */}
                    <div>
                      <h4 className="text-xs font-bold text-destructive mb-2">⚠️ 주의사항</h4>
                      <div className="space-y-1.5">
                        {tactic.warnings.map((w, wi) => (
                          <div key={wi} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TacticsPage;
