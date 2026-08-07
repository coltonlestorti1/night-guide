/**
 * Venue management — edit all 56 venues without touching code or SQL.
 *
 * Writes go through the admin UPDATE policy in
 * scripts/2026-07-28-admin-ddl.sql. Until that is pasted every save fails
 * loudly; that is intentional, because a silent no-op write is the exact bug
 * class this project already hit once.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabase } from "@/lib/supabase";
import { PageHeader, EmptyState, ErrorNote } from "../components/AdminKit";
import { fetchAdminVenues, type AdminVenueRow } from "../data/venues";
import VenueEditSheet from "../components/VenueEditSheet";
import { PLACEHOLDER } from "@/lib/venueImages";

type ActiveFilter = "all" | "active" | "dormant" | "no photo";

const AdminVenues = () => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [editing, setEditing] = useState<AdminVenueRow | null>(null);

  const configured = Boolean(getSupabase());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-venues"],
    queryFn: fetchAdminVenues,
    enabled: configured,
  });

  const venues = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((v) => {
      if (activeFilter === "active" && !v.is_active) return false;
      if (activeFilter === "dormant" && v.is_active) return false;
      if (activeFilter === "no photo" && v.image_url) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.neighborhood ?? "").toLowerCase().includes(q) ||
        (v.music ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, activeFilter]);

  const counts = useMemo(() => {
    const rows = data ?? [];
    return {
      all: rows.length,
      active: rows.filter((v) => v.is_active).length,
      dormant: rows.filter((v) => !v.is_active).length,
      "no photo": rows.filter((v) => !v.image_url).length,
    };
  }, [data]);

  return (
    <>
      <PageHeader
        title="Venues"
        description="Every column the app reads, editable here. Adding and removing venues stays a seed-file operation — those need research behind them."
      />

      {!configured && (
        <ErrorNote>
          Supabase isn&apos;t configured in this environment, so there are no venues
          to load. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </ErrorNote>
      )}

      {error && (
        <ErrorNote>
          Couldn&apos;t load venues: {(error as Error).message}
        </ErrorNote>
      )}

      {configured && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, neighborhood, music"
                className="pl-9"
              />
            </div>
            {(["all", "active", "dormant", "no photo"] as const).map((f) => (
              <Button
                key={f}
                variant={activeFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(f)}
                className="capitalize"
              >
                {f}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[f]}</span>
              </Button>
            ))}
          </div>

          {isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading venues…
            </Card>
          ) : venues.length === 0 ? (
            <EmptyState title="No venues match" icon={Store}>
              {counts.all === 0
                ? "The venues table came back empty. Check that the Supabase project is awake — the free tier pauses after 7 days of no traffic."
                : "Try a different search or filter."}
            </EmptyState>
          ) : (
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14"><span className="sr-only">Photo</span></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Music</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Traits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v) => (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer"
                      onClick={() => setEditing(v)}
                    >
                      <TableCell>
                        <img
                          src={v.image_url || PLACEHOLDER[v.type] || PLACEHOLDER.bar}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {v.name}
                          {(!Number.isFinite(v.lat) || (v.lat === 0 && v.lng === 0)) && (
                            <MapPin className="h-3.5 w-3.5 text-amber-600" />
                          )}
                        </div>
                        {v.neighborhood && (
                          <div className="text-xs text-muted-foreground">
                            {v.neighborhood}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{v.type}</TableCell>
                      <TableCell>{v.price ?? "—"}</TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {v.music ?? "—"}
                      </TableCell>
                      <TableCell>{v.age_range ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {v.is_college_scene && <Badge variant="secondary">College</Badge>}
                          {v.has_rooftop && <Badge variant="secondary">Rooftop</Badge>}
                          {v.has_outdoor && <Badge variant="secondary">Outdoor</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.is_active ? "default" : "outline"}>
                          {v.is_active ? "Active" : "Dormant"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(v);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <VenueEditSheet
        venue={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refetch();
        }}
      />
    </>
  );
};

export default AdminVenues;
