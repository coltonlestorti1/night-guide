import { useEffect } from "react";
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
import VenueDetail from "@/pages/VenueDetail";
import PickUsername from "@/pages/PickUsername";
import LocationPrimer from "@/pages/LocationPrimer";
import Join from "@/pages/Join";
import Qr from "@/pages/Qr";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/auth";

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
              </Route>
              <Route path="welcome" element={<PickUsername />} />
              <Route path="welcome/location" element={<LocationPrimer />} />
              <Route path="join" element={<Join />} />
              <Route path="qr" element={<Qr />} />
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
