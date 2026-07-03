import { useConfigStore } from "@/store/config";
import { ApiDataSource } from "./sources/ApiDataSource";
import { SupabaseDataSource } from "./sources/SupabaseDataSource";
import { DemoDataSource } from "./sources/DemoDataSource";
import { DataSource } from "./sources/DataSource";

export function resolveDataSource(): DataSource {
  const { apiBaseUrl, supabaseUrl, supabaseAnonKey } = useConfigStore.getState();
  if (apiBaseUrl) return new ApiDataSource(apiBaseUrl);
  if (supabaseUrl && supabaseAnonKey) return new SupabaseDataSource();
  // Default to demo data with 19 East Village nightlife venues
  return new DemoDataSource();
}
