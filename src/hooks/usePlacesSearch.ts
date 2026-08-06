/**
 * Debounced venue search through the places-search edge function. Returns an
 * `unavailable` flag rather than throwing: the whole section degrades to
 * disabled if the function is not deployed, and the rest of the screen still
 * submits.
 */
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { PlaceHit } from "@/lib/venueRequests";

export function usePlacesSearch(query: string) {
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled) {
          setUnavailable(true);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase.functions.invoke("places-search", {
        body: { query: q },
      });
      if (cancelled) return;
      if (error) {
        setUnavailable(true);
        setResults([]);
      } else {
        setUnavailable(false);
        setResults((data?.results ?? []) as PlaceHit[]);
      }
      setLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return { results, loading, unavailable };
}
