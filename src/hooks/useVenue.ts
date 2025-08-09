import { useQuery } from "@tanstack/react-query";
import { resolveDataSource } from "@/data/resolver";
import { Venue } from "@/data/types";

export function useVenue(id?: string) {
  const source = resolveDataSource();
  return useQuery<Venue | null>({
    queryKey: ["venue", source.kind, id],
    enabled: !!id,
    queryFn: ({ signal }) => source.getVenue(id!, signal),
    staleTime: 60_000,
  });
}
