/**
 * Single shared Supabase client. Everything (data sources, auth) goes
 * through getSupabase() — nothing else constructs clients.
 *
 * Config precedence: build-time env vars (what production uses) first,
 * then the Profile-tab config store as a manual fallback. Returns null
 * when neither is set, so callers can fall back to demo behavior.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useConfigStore } from "@/store/config";

let client: SupabaseClient | null = null;
let clientCacheKey = "";

export function getSupabase(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = useConfigStore.getState();
  const url = import.meta.env.VITE_SUPABASE_URL || supabaseUrl;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || supabaseAnonKey;
  if (!url || !key) return null;

  const cacheKey = `${url}|${key}`;
  if (!client || clientCacheKey !== cacheKey) {
    client = createClient(url, key);
    clientCacheKey = cacheKey;
  }
  return client;
}
