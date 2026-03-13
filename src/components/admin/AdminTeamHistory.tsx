import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Upload, Pencil, X } from "lucide-react";

interface HistoryItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  year: number | null;
  image_url: string | null;
  sort_order: number | null;
}

const EMPTY_FORM = { category: "logo", title: "", description: "", year: "", sort_order: "0" };

const categories = [
  { value: "logo", label: "🏟️ 엠블럼" },
  { value: "uniform", label: "👕 유니폼" },
  { value: "milestone", label: "📰 보도자료" },
];

const AdminTeamHistory = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["team_history"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("team_history").select("*").order("sort_order", { ascending: true });
      return (data ?? []) as HistoryItem[];
    },
  });

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    const ext = imageFile.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("team-history").upload(path, imageFile);
    if (uploadError) { setUploading(false); throw uploadError; }
    const { data: urlData } = supabase.storage.from("team-history").getPublicUrl(path);
    setUploading(false);
    return urlData.publicUrl;
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const imageUrl = await uploadImage();
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
      resetForm();
      toast.success("항목이 추가되었습니다");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const imageUrl = await uploadImage();
      const updateData: any = {
        category: form.category,
        title: form.title,
        description: form.description || null,
        year: form.year ? parseInt(form.year) : null,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (imageUrl) updateData.image_url = imageUrl;
      const { error } = await (supabase as any).from("team_history").update(updateData).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_history"] });
      resetForm();
      toast.success("수정되었습니다");
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

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setEditingId(null);
  };

  const startEdit = (item: HistoryItem) => {
    setEditingId(item.id);
    setForm({
      category: item.category,
      title: item.title,
      description: item.description || "",
      year: item.year?.toString() || "",
      sort_order: item.sort_order?.toString() || "0",
    });
    setImageFile(null);
  };

  const isEditing = editingId !== null;
  const isPending = addMutation.isPending || updateMutation.isPending || uploading;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{isEditing ? "항목 수정" : "새 항목 추가"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm}><X size={14} className="mr-1" /> 취소</Button>
          )}
        </div>
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
            {imageFile ? imageFile.name : isEditing ? "새 이미지 선택 (선택사항)" : "이미지 선택"}
            <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <Button
          onClick={() => isEditing ? updateMutation.mutate() : addMutation.mutate()}
          disabled={!form.title || isPending}
          className="w-full"
        >
          {isEditing ? (
            <><Pencil size={14} className="mr-1" /> {uploading ? "업로드 중..." : "수정 저장"}</>
          ) : (
            <><Plus size={14} className="mr-1" /> {uploading ? "업로드 중..." : "추가"}</>
          )}
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
                <div key={item.id} className={`flex items-center justify-between rounded-lg border bg-card p-3 mb-2 ${editingId === item.id ? "border-primary" : "border-border"}`}>
                  <div className="flex items-center gap-3">
                    {item.image_url && <img src={item.image_url} alt={item.title} className="h-10 w-10 rounded-lg object-cover" />}
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="text-[10px] text-muted-foreground">{item.year && `${item.year}년`} {item.description?.slice(0, 30)}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)} disabled={editingId === item.id}>
                      <Pencil size={14} className="text-primary" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(item.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
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
