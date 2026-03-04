import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import SplashScreen from "@/components/SplashScreen";
import AdminMatchCreate from "@/components/admin/AdminMatchCreate";
import AdminMatchResult from "@/components/admin/AdminMatchResult";
import AdminAttendance from "@/components/admin/AdminAttendance";
import AdminDues from "@/components/admin/AdminDues";

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
          <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
            <TabsTrigger value="attendance" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">참석</TabsTrigger>
            <TabsTrigger value="create" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">경기생성</TabsTrigger>
            <TabsTrigger value="result" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">결과기록</TabsTrigger>
            <TabsTrigger value="dues" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">회비</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance"><AdminAttendance /></TabsContent>
          <TabsContent value="create"><AdminMatchCreate /></TabsContent>
          <TabsContent value="result"><AdminMatchResult /></TabsContent>
          <TabsContent value="dues"><AdminDues /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
