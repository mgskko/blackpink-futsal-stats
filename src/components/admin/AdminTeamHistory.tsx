import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Upload } from "lucide-react";

interface HistoryItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  year: number | null;
  image_url: string | null;
  sort_order: number | null;
}

const AdminTeamHistory = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ category: "logo", title: "", description: "", year: "", sort_order: "0" });
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["team_history"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("team_history").select("*").order("sort_order", { ascending: true });
      return (data ?? []) as HistoryItem[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      let imageUrl: string | null = null;
      if (imageFile) {
        setUploading(true);
        const ext = imageFile.name.split(".").pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("team-history").upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("team-history").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
        setUploading(false);
      }
      const { error } = await (supabase as any).from("team_history").insert({
        category: form.category,
        title: form.title,
        description: form.description || null,
        year: form.year ? parseInt(form.year) : null,
        image_url: imageUrl,
        sort_order: parseInt(form.sort_order) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_history"] });
      setForm({ category: "logo", title: "", description: "", year: "", sort_order: "0" });
      setImageFile(null);
      toast.success("항목이 추가되었습니다");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("team_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_history"] });
      toast.success("삭제되었습니다");
    },
  });

  const categories = [
    { value: "logo", label: "🏟️ 엠블럼" },
    { value: "uniform", label: "👕 유니폼" },
    { value: "milestone", label: "🏆 마일스톤" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">새 항목 추가</h3>
        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea placeholder="설명" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <div className="flex gap-2">
          <Input type="number" placeholder="연도" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-24" />
          <Input type="number" placeholder="순서" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className="w-20" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">
            <Upload size={14} />
            {imageFile ? imageFile.name : "이미지 선택"}
            <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <Button onClick={() => addMutation.mutate()} disabled={!form.title || addMutation.isPending || uploading} className="w-full">
          <Plus size={14} className="mr-1" /> {uploading ? "업로드 중..." : "추가"}
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat.value);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.value}>
              <h4 className="text-xs font-bold text-muted-foreground mb-2">{cat.label}</h4>
              {catItems.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 mb-2">
                  <div className="flex items-center gap-3">
                    {item.image_url && <img src={item.image_url} alt={item.title} className="h-10 w-10 rounded-lg object-cover" />}
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="text-[10px] text-muted-foreground">{item.year && `${item.year}년`} {item.description?.slice(0, 30)}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(item.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminTeamHistory;
