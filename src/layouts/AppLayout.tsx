import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomTabs from "@/components/layout/BottomTabs";
import { useAuthStore } from "@/store/auth";

const AppLayout = () => {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();

  // First sign-in with no profile row yet -> finish onboarding before anything else
  useEffect(() => {
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <main className="pb-[110px]" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}>
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
};

export default AppLayout;
