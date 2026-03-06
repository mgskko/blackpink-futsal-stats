import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import MatchesPage from "@/pages/MatchesPage";
import MatchDetailPage from "@/pages/MatchDetailPage";
import PlayersPage from "@/pages/PlayersPage";
import PlayerDetailPage from "@/pages/PlayerDetailPage";
import StatisticsPage from "@/pages/StatisticsPage";
import ComparisonPage from "@/pages/ComparisonPage";
import MyPage from "@/pages/MyPage";
import AdminPage from "@/pages/AdminPage";
import TacticsPage from "@/pages/TacticsPage";
import GuidePage from "@/pages/GuidePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="mx-auto min-h-screen max-w-lg bg-background">
            <Routes>
              <Route path="/" element={<MatchesPage />} />
              <Route path="/match/:id" element={<MatchDetailPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/player/:id" element={<PlayerDetailPage />} />
              <Route path="/stats" element={<StatisticsPage />} />
              <Route path="/compare" element={<ComparisonPage />} />
              <Route path="/tactics" element={<TacticsPage />} />
              <Route path="/my" element={<MyPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
            <PWAInstallPrompt />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
