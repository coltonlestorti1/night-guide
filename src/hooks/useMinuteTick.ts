import { useEffect, useState } from "react";

/**
 * Re-renders the consumer once a minute so time-derived UI (open state,
 * happy-hour rings) flips at boundaries without a reload.
 */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return tick;
}
