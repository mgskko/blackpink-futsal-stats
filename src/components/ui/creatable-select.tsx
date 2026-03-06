import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

const CreatableSelect = ({ value, onChange, options, placeholder = "선택 또는 입력", className }: CreatableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()));
  const showCreate = inputValue.trim() && !options.some(o => o.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center justify-between rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-secondary transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
        <ChevronsUpDown size={12} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          <input
            autoFocus
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="검색 또는 새 항목 입력..."
            className="w-full border-b border-border bg-transparent px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); setInputValue(""); }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
              >
                {value === o && <Check size={10} className="text-primary" />}
                <span className={value === o ? "ml-0" : "ml-[14px]"}>{o}</span>
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onClick={() => { onChange(inputValue.trim()); setOpen(false); setInputValue(""); }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-primary hover:bg-secondary transition-colors border-t border-border"
              >
                <Plus size={10} />
                <span>"{inputValue.trim()}" 추가</span>
              </button>
            )}
            {filtered.length === 0 && !showCreate && (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">결과 없음</div>
            )}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setInputValue(""); }}
              className="w-full border-t border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors text-center"
            >
              선택 해제
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CreatableSelect;
