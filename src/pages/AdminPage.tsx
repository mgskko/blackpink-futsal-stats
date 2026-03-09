import { useState } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import AdminMatchCreate from "@/components/admin/AdminMatchCreate";
import AdminMatchResult from "@/components/admin/AdminMatchResult";
import AdminMatchEdit from "@/components/admin/AdminMatchEdit";
import AdminAttendance from "@/components/admin/AdminAttendance";
import AdminDues from "@/components/admin/AdminDues";
import AdminManageRoles from "@/components/admin/AdminManageRoles";
import AdminPlayerManage from "@/components/admin/AdminPlayerManage";
import AdminTeamHistory from "@/components/admin/AdminTeamHistory";

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <SplashScreen />;

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 pb-20">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground">관리자 권한이 필요합니다</p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader title="ADMIN" subtitle="관리자 패널" />
      <div className="px-4">
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-8 bg-card border border-border">
            <TabsTrigger value="attendance" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">참석</TabsTrigger>
            <TabsTrigger value="create" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">생성</TabsTrigger>
            <TabsTrigger value="result" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">기록</TabsTrigger>
            <TabsTrigger value="edit" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">수정</TabsTrigger>
            <TabsTrigger value="dues" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">회비</TabsTrigger>
            <TabsTrigger value="players" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">선수</TabsTrigger>
            <TabsTrigger value="history" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">역사</TabsTrigger>
            <TabsTrigger value="roles" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">권한</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance"><AdminAttendance /></TabsContent>
          <TabsContent value="create"><AdminMatchCreate /></TabsContent>
          <TabsContent value="result"><AdminMatchResult /></TabsContent>
          <TabsContent value="edit"><AdminMatchEdit /></TabsContent>
          <TabsContent value="dues"><AdminDues /></TabsContent>
          <TabsContent value="players"><AdminPlayerManage /></TabsContent>
          <TabsContent value="history"><AdminTeamHistory /></TabsContent>
          <TabsContent value="roles"><AdminManageRoles /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
