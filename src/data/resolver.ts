import { useConfigStore } from "@/store/config";
import { ApiDataSource } from "./sources/ApiDataSource";
import { SupabaseDataSource } from "./sources/SupabaseDataSource";
import { NullDataSource } from "./sources/NullDataSource";
import { DataSource } from "./sources/DataSource";

export function resolveDataSource(): DataSource {
  const { apiBaseUrl, supabaseUrl, supabaseAnonKey } = useConfigStore.getState();
  if (apiBaseUrl) return new ApiDataSource(apiBaseUrl);
  if (supabaseUrl && supabaseAnonKey) return new SupabaseDataSource();
  return new NullDataSource();
}
