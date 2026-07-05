import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppConfig = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

interface ConfigState extends AppConfig {
  setConfig: (cfg: Partial<AppConfig>) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      apiBaseUrl: undefined,
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
      setConfig: (cfg) => set((s) => ({ ...s, ...cfg })),
    }),
    { name: "endz-config" }
  )
);
