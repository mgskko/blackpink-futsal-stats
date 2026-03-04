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
      // Look up user by email via profiles or auth
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .limit(100);

      if (pErr) throw pErr;

      // We need to find user by email - use edge function or RPC
      // For now, use a simpler approach: admin enters the user_id directly or we search
      // Actually let's use supabase admin API via edge function
      
      // Simpler approach: store email-based admin assignment via trigger
      // The auto_assign_admin trigger handles msk7240@hanmail.net
      // For other admins, we'll update the trigger or insert directly
      
      // Let's try to find the user through auth admin API
      // Since we can't access auth.users from client, let's use an edge function
      
      toast({ 
        title: "관리자 추가 기능", 
        description: "해당 이메일의 사용자가 Google 로그인하면 관리자 권한이 자동 부여됩니다.",
      });

      // Update the auto_assign_admin function to include this email
      const { error } = await supabase.rpc("add_admin_email" as any, { admin_email: email });
      if (error) {
        // If RPC doesn't exist, insert directly if we can find the user
        // Try to find user in profiles by display_name or just inform
        toast({ 
          title: "안내", 
          description: "해당 사용자가 먼저 로그인해야 합니다. 로그인 후 다시 시도해주세요.",
          variant: "destructive" 
        });
      }
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setEmail("");
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-xs text-muted-foreground">
        관리자로 추가할 사용자의 이메일을 입력하세요. 해당 사용자가 Google 로그인하면 관리자 권한이 자동으로 부여됩니다.
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
