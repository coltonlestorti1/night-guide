import { Outlet } from "react-router-dom";
import BottomTabs from "@/components/layout/BottomTabs";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
};

export default AppLayout;
