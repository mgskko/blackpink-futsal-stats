import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import BloomBackground from "@/components/BloomBackground";
import LiquidGlassDefs from "@/components/fx/LiquidGlassDefs";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import RouteLoader from "@/components/RouteLoader";
import ScrollToTop from "@/components/ScrollToTop";
import MatchesPage from "@/pages/MatchesPage";

// Home is eager (first paint); every other page is its own chunk.
const MatchDetailPage = lazy(() => import("@/pages/MatchDetailPage"));
const PlayersPage = lazy(() => import("@/pages/PlayersPage"));
const PlayerDetailPage = lazy(() => import("@/pages/PlayerDetailPage"));
const StatisticsPage = lazy(() => import("@/pages/StatisticsPage"));
const ComparisonPage = lazy(() => import("@/pages/ComparisonPage"));
const TacticsPage = lazy(() => import("@/pages/TacticsPage"));
const ClubhousePage = lazy(() => import("@/pages/ClubhousePage"));
const TreasuryPage = lazy(() => import("@/pages/TreasuryPage"));
const MyPage = lazy(() => import("@/pages/MyPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Club data changes a few times a week — don't refetch 7 tables on every tab switch.
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  const location = useLocation();
  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteLoader />}>
        <Routes location={location}>
          <Route path="/" element={<MatchesPage />} />
          <Route path="/match/:id" element={<MatchDetailPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/player/:id" element={<PlayerDetailPage />} />
          <Route path="/stats" element={<StatisticsPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
          <Route path="/tactics" element={<TacticsPage />} />
          <Route path="/guide" element={<ClubhousePage />} />
          <Route path="/clubhouse" element={<Navigate to="/guide" replace />} />
          <Route path="/treasury" element={<TreasuryPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="bunnies-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LiquidGlassDefs />
          <BrowserRouter>
            <ScrollToTop />
            <div className="relative mx-auto min-h-screen max-w-lg overflow-x-clip bg-background safe-bottom">
              <BloomBackground />
              <AppRoutes />
              <BottomNav />
              <PWAInstallPrompt />
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
