import { useQuery } from "@tanstack/react-query";
import { resolveDataSource } from "@/data/resolver";
import { VenueQuery, Venue } from "@/data/types";

export function useVenues(q: VenueQuery) {
  const source = resolveDataSource();
  return useQuery<Venue[]>({
    queryKey: ["venues", source.kind, q],
    queryFn: ({ signal }) => source.getVenues(q, signal),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}
