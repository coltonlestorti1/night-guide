export type AnalyticsEvent = {
  name: string;
  payload?: Record<string, unknown>;
};

export function track(name: string, payload?: Record<string, unknown>) {
  // Stub for future analytics provider integration
  if (import.meta.env.MODE === "development") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", name, payload ?? {});
  }
}
