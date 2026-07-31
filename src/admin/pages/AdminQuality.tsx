/**
 * Data quality + verification.
 *
 * The most useful view in v1 and the one that needs no new schema: it joins
 * live `venues` rows against the two bundled JSON files (Google enrichment and
 * heat baselines) and reports what is real versus guessed.
 *
 * As of 2026-07-28 that answer is uncomfortable — 41 of 56 heat baselines are
 * archetype defaults and only 11 venues have a researched busy window — which
 * is exactly why it's worth showing.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabase } from "@/lib/supabase";
import type { VenueBaseline } from "@/lib/heat/types";
import baselineJson from "@/data/activity/baseline.json";
import enrichmentJson from "@/data/enrichment/enrichment.json";
import { fetchAdminVenues } from "../data/venues";
import {
  scoreVenue,
  summarize,
  type EnrichmentFacts,
  type VenueQuality,
} from "../data/quality";
import {
  PageHeader,
  StatCard,
  SectionHeader,
  EmptyState,
  ErrorNote,
} from "../components/AdminKit";

// Read the raw JSON rather than getEnrichment(), which hides expired records
// by returning undefined. Staleness is the thing this page exists to report.
const BASELINES = baselineJson as Record<string, VenueBaseline>;
const ENRICHMENT = enrichmentJson as Record<string, EnrichmentFacts>;

type SortKey = "score" | "name" | "baseline";

const GRADE_STYLES: Record<VenueQuality["grade"], string> = {
  solid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  thin: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  guessed: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

const SOURCE_LABEL: Record<string, string> = {
  first_hand: "First-hand",
  research_estimate: "Researched",
  archetype_default: "Guessed",
};

const AdminQuality = () => {
  const [sort, setSort] = useState<SortKey>("score");
  const [onlyGuessed, setOnlyGuessed] = useState(false);
  // Default to active only. Dormant rows are not user-facing, and one of them
  // (Cienfuegos) is a permanently-closed tombstone kept so it can be flipped
  // back — scoring it as if its blank fields were work to do is just noise.
  const [activeOnly, setActiveOnly] = useState(true);
  const configured = Boolean(getSupabase());

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-venues"],
    queryFn: fetchAdminVenues,
    enabled: configured,
  });

  // Scored once, then filtered — so the summary cards and the table always
  // describe the same set of venues.
  const scored = useMemo(
    () =>
      (data ?? [])
        .filter((v) => !activeOnly || v.is_active)
        .map((v) => scoreVenue(v, ENRICHMENT[v.name], BASELINES[v.name])),
    [data, activeOnly],
  );

  const rows = useMemo(() => {
    const filtered = onlyGuessed
      ? scored.filter((r) => r.baseline.sourceType === "archetype_default")
      : scored;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "baseline") return a.baseline.hasWindow === b.baseline.hasWindow ? a.score - b.score : a.baseline.hasWindow ? 1 : -1;
      return a.score - b.score; // worst first — this is a worklist
    });
  }, [scored, sort, onlyGuessed]);

  const summary = useMemo(() => summarize(scored), [scored]);

  const dormantCount = (data ?? []).filter((v) => !v.is_active).length;

  return (
    <>
      <PageHeader
        title="Data quality"
        description="What we actually know about each venue, and how much of it is a guess. Joins live venue rows against Google enrichment and the heat baselines — worst first."
      />

      {!configured && (
        <ErrorNote>
          Supabase isn&apos;t configured here, so there are no venue rows to score
          against.
        </ErrorNote>
      )}
      {error && <ErrorNote>Couldn&apos;t load venues: {(error as Error).message}</ErrorNote>}

      {configured && !isLoading && summary.total > 0 && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Average score"
              value={`${summary.averageScore}%`}
              hint={`${summary.solid} solid · ${summary.thin} thin · ${summary.guessed} guessed`}
            />
            <StatCard
              label="Guessed heat curves"
              value={summary.archetypeDefaults}
              tone={summary.archetypeDefaults > 0 ? "warn" : "default"}
              hint="Archetype defaults, not research. Biggest lever on the map."
            />
            <StatCard
              label="Researched windows"
              value={summary.researchedWindows}
              hint="Venues with a real busy_start / busy_end."
            />
            <StatCard
              label="Stale enrichment"
              value={summary.staleEnrichment}
              tone={summary.staleEnrichment > 0 ? "warn" : "default"}
              hint={
                summary.staleEnrichment > 0
                  ? "Run scripts/enrich-venues.mjs refresh"
                  : "All inside Google's 30-day cache window."
              }
            />
          </div>

          {summary.brokenCoords > 0 && (
            <div className="mb-4">
              <ErrorNote>
                {summary.brokenCoords} venue
                {summary.brokenCoords === 1 ? " has" : "s have"} an invalid
                coordinate — those pins won&apos;t render on the map. Fix them in
                the Venues tab.
              </ErrorNote>
            </div>
          )}

          <SectionHeader
            title={`${rows.length} venue${rows.length === 1 ? "" : "s"}`}
            description="Click through to Venues to fix the DB columns. Baselines are hand-edited in src/data/activity/baseline.json."
            actions={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={activeOnly ? "default" : "outline"}
                  onClick={() => setActiveOnly((v) => !v)}
                >
                  Active only
                  {dormantCount > 0 && (
                    <span className="ml-1.5 opacity-70">
                      {activeOnly ? `+${dormantCount}` : dormantCount}
                    </span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant={onlyGuessed ? "default" : "outline"}
                  onClick={() => setOnlyGuessed((v) => !v)}
                >
                  Only guessed
                </Button>
                {(["score", "name", "baseline"] as const).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={sort === k ? "default" : "outline"}
                    onClick={() => setSort(k)}
                    className="capitalize"
                  >
                    {k}
                  </Button>
                ))}
              </div>
            }
          />

          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead className="w-[160px]">Score</TableHead>
                  <TableHead>Missing fields</TableHead>
                  <TableHead>Enrichment</TableHead>
                  <TableHead>Heat baseline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {r.title}
                        {!r.isActive && <Badge variant="outline">Dormant</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={r.score} className="h-1.5 w-16" />
                        <span className="tabular-nums text-xs">{r.score}%</span>
                        <Badge className={GRADE_STYLES[r.grade]} variant="secondary">
                          {r.grade}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.missingDbFields.length === 0 && r.hasValidCoords ? (
                        <span className="text-xs text-muted-foreground">Complete</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {!r.hasValidCoords && (
                            <Badge variant="destructive">coords</Badge>
                          )}
                          {r.missingDbFields.map((f) => (
                            <Badge key={f} variant="outline" className="text-xs">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {!r.enrichment.present ? (
                        <span className="text-rose-700">Missing</span>
                      ) : r.enrichment.expired ? (
                        <span className="text-rose-700">
                          Expired ({r.enrichment.ageDays}d)
                        </span>
                      ) : r.enrichment.stale ? (
                        <span className="text-amber-700">
                          {r.enrichment.ageDays}d old
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {r.enrichment.ageDays}d
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {!r.baseline.present ? (
                        <span className="text-rose-700">None</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div
                            className={
                              r.baseline.sourceType === "archetype_default"
                                ? "text-rose-700"
                                : "text-foreground"
                            }
                          >
                            {SOURCE_LABEL[r.baseline.sourceType ?? ""] ??
                              r.baseline.sourceType}
                          </div>
                          <div className="text-muted-foreground">
                            {r.baseline.hasWindow ? "busy window set" : "no window"}
                            {r.baseline.stale && " · needs review"}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            Heat baselines are editorial content in{" "}
            <code>src/data/activity/baseline.json</code> — hand-edited and
            committed, not stored in Supabase.
          </p>
        </>
      )}

      {configured && isLoading && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Scoring venues…
        </Card>
      )}

      {configured && !isLoading && summary.total === 0 && !error && (
        <EmptyState title="No venues to score" icon={ClipboardCheck}>
          The venues table came back empty. The Supabase free tier pauses after 7
          days of no traffic — check the project is awake.
        </EmptyState>
      )}
    </>
  );
};

export default AdminQuality;
