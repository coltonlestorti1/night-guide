/**
 * One page serving every deferred nav slot. It states what the section is
 * waiting on rather than showing a fake shell, which keeps the IA honest and
 * means adding a real section later is a route swap, not a rewrite.
 */
import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import { ADMIN_NAV_DEFERRED } from "../nav";
import { PageHeader, EmptyState } from "../components/AdminKit";

const DeferredSection = () => {
  const { pathname } = useLocation();
  const item = ADMIN_NAV_DEFERRED.find((i) => i.to === pathname);

  return (
    <>
      <PageHeader title={item?.label ?? "Not built yet"} />
      <EmptyState title="This section isn't built yet" icon={Construction}>
        {item?.blockedOn ??
          "No backing table for this section yet. It is a nav placeholder."}
      </EmptyState>
    </>
  );
};

export default DeferredSection;
