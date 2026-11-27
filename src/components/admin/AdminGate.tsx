import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SplashScreen from "@/components/SplashScreen";

/** Renders children only for admins. */
export default function AdminGate({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user || !isAdmin) {
    return (
      <div className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center gap-4">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground">관리자 권한이 필요합니다</p>
      </div>
    );
  }
  return <>{children}</>;
}
