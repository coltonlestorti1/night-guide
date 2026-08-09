import { NavLink } from "react-router-dom";
import { Compass, Map, Users, UserRound } from "lucide-react";
import { useSocialUnread } from "@/hooks/useSocialUnread";
import { badgeLabel } from "@/lib/social/unread";

const Tab = ({ to, label, Icon, badge = 0 }: { to: string; label: string; Icon: any; badge?: number }) => {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "flex flex-col items-center justify-center gap-1 flex-1 min-h-[48px] py-2 text-xs font-medium rounded-xl transition-colors",
          "lg:flex-none lg:w-14 lg:h-14 lg:gap-0.5 lg:text-[10px]",
          isActive
            ? "text-primary lg:bg-primary-soft"
            : "text-muted-foreground hover:text-foreground lg:hover:bg-secondary",
        ].join(" ")
      }
      aria-label={badge > 0 ? `${label} — ${badge} new` : label}
    >
      {/* relative wraps the ICON only, so the pill tracks the glyph rather
          than the whole tab column, which would put it out over the label. */}
      <span className="relative">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {badge > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center
                       rounded-full bg-primary px-1 text-[10px] font-bold leading-none
                       text-primary-foreground"
          >
            {badgeLabel(badge)}
          </span>
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  );
};

const BottomTabs = () => {
  const unread = useSocialUnread();

  return (
    <nav
      className="fixed z-50 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-border
                 bottom-0 inset-x-0 border-t
                 lg:inset-x-auto lg:top-0 lg:bottom-0 lg:left-0 lg:w-20 lg:border-t-0 lg:border-r"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Brand mark — desktop rail only */}
      <div className="hidden lg:flex items-center justify-center h-16 mb-2">
        <span className="font-display font-bold text-primary text-lg tracking-tight">E</span>
      </div>
      <div className="mx-auto max-w-3xl flex items-center px-2 gap-1
                      lg:flex-col lg:max-w-none lg:px-3 lg:gap-2">
        <Tab to="/" label="Map" Icon={Map} />
        <Tab to="/discover" label="Discover" Icon={Compass} />
        <Tab to="/social" label="Social" Icon={Users} badge={unread} />
        <Tab to="/profile" label="Profile" Icon={UserRound} />
      </div>
    </nav>
  );
};

export default BottomTabs;
