import { useConfigStore } from "@/store/config";
import { ApiDataSource } from "./sources/ApiDataSource";
import { SupabaseDataSource } from "./sources/SupabaseDataSource";
import { DemoDataSource } from "./sources/DemoDataSource";
import { DataSource } from "./sources/DataSource";
import { getSupabase } from "@/lib/supabase";

export function resolveDataSource(): DataSource {
  const { apiBaseUrl } = useConfigStore.getState();
  if (apiBaseUrl) return new ApiDataSource(apiBaseUrl);
  // Live backend whenever the Supabase client is configured (env vars or Profile tab)
  if (getSupabase()) return new SupabaseDataSource();
  // Demo dataset only as the no-config fallback
  return new DemoDataSource();
}
