import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";

const AdminManageRoles = () => {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddAdmin = async () => {
    if (!email.trim()) {
      toast({ title: "이메일을 입력하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("add_admin_by_email" as any, { admin_email: email.trim() });
      if (error) throw error;

      if (data === "USER_NOT_FOUND") {
        toast({
          title: "사용자를 찾을 수 없습니다",
          description: "해당 이메일로 먼저 Google 로그인을 해야 합니다.",
          variant: "destructive",
        });
      } else {
        toast({ title: "관리자 권한이 부여되었습니다! 🎉" });
        setEmail("");
      }
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-xs text-muted-foreground">
        관리자로 추가할 사용자의 이메일을 입력하세요. 해당 사용자가 먼저 Google 로그인을 완료해야 합니다.
      </p>
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일 주소 입력"
          className="bg-card border-border flex-1"
        />
        <Button onClick={handleAddAdmin} disabled={saving} size="sm" className="gradient-pink text-primary-foreground">
          <UserPlus size={14} />
        </Button>
      </div>
    </div>
  );
};

export default AdminManageRoles;
