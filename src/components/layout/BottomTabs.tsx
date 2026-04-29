import { NavLink } from "react-router-dom";
import { Compass, Map, Users, UserRound } from "lucide-react";

const Tab = ({ to, label, Icon }: { to: string; label: string; Icon: any }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 flex-1 py-2 text-xs transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`
      }
      aria-label={label}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
};

const BottomTabs = () => {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-3xl flex items-center">
        <Tab to="/" label="Map" Icon={Map} />
        <Tab to="/discover" label="Discover" Icon={Compass} />
        <Tab to="/social" label="Social" Icon={Users} />
        <Tab to="/profile" label="Profile" Icon={UserRound} />
      </div>
    </nav>
  );
};

export default BottomTabs;
