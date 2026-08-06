/**
 * The whole /admin/* route subtree, in one module so App.tsx can lazy-load it.
 *
 * Why this file exists: every admin page used to be a static import in
 * App.tsx, which put the entire operator tool — and the names of the admin
 * RPCs it calls — into the main bundle downloaded by every visitor. Flagged in
 * the 2026-08-05 pre-launch safety check as an open finding. Keeping the routes
 * here means one lazy boundary covers all of them, including the nav table.
 *
 * Paths are relative because App.tsx mounts this under `admin/*`.
 */
import { Route, Routes } from "react-router-dom";
import AdminRoute from "@/admin/AdminRoute";
import AdminLayout from "@/admin/AdminLayout";
import AdminOverview from "@/admin/pages/AdminOverview";
import AdminVenues from "@/admin/pages/AdminVenues";
import AdminQuality from "@/admin/pages/AdminQuality";
import DeferredSection from "@/admin/pages/DeferredSection";
import { ADMIN_NAV_DEFERRED } from "@/admin/nav";

const AdminRoutes = () => (
  <Routes>
    <Route element={<AdminRoute />}>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="venues" element={<AdminVenues />} />
        <Route path="quality" element={<AdminQuality />} />
        {ADMIN_NAV_DEFERRED.map((item) => (
          <Route
            key={item.to}
            path={item.to.replace("/admin/", "")}
            element={<DeferredSection />}
          />
        ))}
      </Route>
    </Route>
  </Routes>
);

export default AdminRoutes;
