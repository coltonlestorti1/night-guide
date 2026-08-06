import { lazy, Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import MapPage from "@/pages/MapPage";
import Discover from "@/pages/Discover";
import Social from "@/pages/Social";
import Profile from "@/pages/Profile";
import UserProfile from "@/pages/UserProfile";
import VenueDetail from "@/pages/VenueDetail";
import PickUsername from "@/pages/PickUsername";
import AboutYou from "@/pages/AboutYou";
import PickSpots from "@/pages/PickSpots";
import LocationPrimer from "@/pages/LocationPrimer";
import Join from "@/pages/Join";
import Qr from "@/pages/Qr";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import PlanPage from "@/pages/PlanPage";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/auth";
// Lazy: the operator tool is for a handful of accounts, so it must not ship in
// the bundle every visitor downloads — and a static import also published the
// admin RPC names to anyone reading the JS. Open finding from the 2026-08-05
// pre-launch safety check.
const AdminRoutes = lazy(() => import("@/admin/AdminRoutes"));

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<MapPage />} />
                <Route path="discover" element={<Discover />} />
                <Route path="venue/:id" element={<VenueDetail />} />
                <Route path="social" element={<Social />} />
                <Route path="profile" element={<Profile />} />
                <Route path="u/:username" element={<UserProfile />} />
              </Route>
              <Route path="welcome" element={<PickUsername />} />
              <Route path="welcome/about" element={<AboutYou />} />
              <Route path="welcome/spots" element={<PickSpots />} />
              <Route path="welcome/location" element={<LocationPrimer />} />
              <Route path="join" element={<Join />} />
              <Route path="qr" element={<Qr />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="p/:token" element={<PlanPage />} />
              {/* Admin: role-gated operator tool, outside AppLayout so it
                  never inherits the consumer bottom nav or map chrome.
                  Code-split — see src/admin/AdminRoutes.tsx. */}
              <Route
                path="admin/*"
                element={
                  <Suspense
                    fallback={
                      <div className="flex min-h-screen items-center justify-center bg-background">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <AdminRoutes />
                  </Suspense>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
