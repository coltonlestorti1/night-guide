import { Outlet } from "react-router-dom";
import BottomTabs from "@/components/layout/BottomTabs";

const AppLayout = () => {
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
