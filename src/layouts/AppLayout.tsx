import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import BottomTabs from "@/components/layout/BottomTabs";
import BuildUpdateBanner from "@/components/BuildUpdateBanner";
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
  // every open map refetches counts within ~2s. Friends presence rides the
  // same content-free poke — identities only ever come back through the
  // RLS-guarded refetch, never over the channel.
  useEffect(() => {
    return subscribeActivity(() => {
      queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
      queryClient.invalidateQueries({ queryKey: ["friends-out-tonight"] });
    });
  }, [queryClient]);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* --endz-update-banner-h is 0px until BuildUpdateBanner shows, so this
          is the same 110px reservation it has always been; while the banner is
          up, page content is pushed clear of it rather than sliding under. */}
      <main
        className="pb-[calc(110px+var(--endz-update-banner-h)+env(safe-area-inset-bottom))]
                   lg:pb-[calc(1rem+var(--endz-update-banner-h))] lg:pl-20"
      >
        <Outlet />
      </main>
      <BuildUpdateBanner />
      <BottomTabs />
    </div>
  );
};

export default AppLayout;
