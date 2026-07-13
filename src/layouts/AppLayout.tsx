import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import BottomTabs from "@/components/layout/BottomTabs";
import { useAuthStore } from "@/store/auth";
import { subscribeActivity } from "@/lib/checkins";

const AppLayout = () => {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // First sign-in with no profile row yet -> finish onboarding before anything else
  useEffect(() => {
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  // Live venue activity: any client's check-in/out pokes this channel and
  // every open map refetches counts within ~2s.
  useEffect(() => {
    return subscribeActivity(() => {
      queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
    });
  }, [queryClient]);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <main className="pb-[calc(110px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-20">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
};

export default AppLayout;
