import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  createInitialOfficeWorldData,
  reconcileOfficeWorldSnapshot,
  type OfficeWorldChangedKey,
  type OfficeWorldData,
  type OfficeWorldRefreshReason,
  type OfficeWorldSnapshot,
} from "./office-world-reconciliation";

export type OfficeWorldStore = OfficeWorldData & {
  applySnapshot: (
    snapshot: OfficeWorldSnapshot,
    reason: OfficeWorldRefreshReason,
  ) => OfficeWorldChangedKey[];
  setLoading: (isLoading: boolean, reason: OfficeWorldRefreshReason) => OfficeWorldChangedKey[];
  setError: (error: string, reason?: OfficeWorldRefreshReason) => OfficeWorldChangedKey[];
  reset: () => void;
};

export const useOfficeWorldStore = create<OfficeWorldStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialOfficeWorldData(),
    applySnapshot: (snapshot, reason) => {
      const { next, changedKeys } = reconcileOfficeWorldSnapshot(get(), snapshot, reason);
      if (changedKeys.length === 0) return changedKeys;
      set(next);
      return changedKeys;
    },
    setLoading: (isLoading, reason) => {
      const current = get();
      if (current.isLoading === isLoading) return [];
      set({
        isLoading,
        lastRefreshReason: reason,
        lastChangedKeys: ["loading"],
        lastUpdatedAt: Date.now(),
      });
      return ["loading"];
    },
    setError: (error, reason = "error") => {
      const current = get();
      if ((current.error ?? "") === error && !current.isLoading) return [];
      set({
        error,
        isLoading: false,
        lastRefreshReason: reason,
        lastChangedKeys: ["error", ...(current.isLoading ? (["loading"] as const) : [])],
        lastUpdatedAt: Date.now(),
      });
      return current.isLoading ? ["error", "loading"] : ["error"];
    },
    reset: () => set(createInitialOfficeWorldData()),
  })),
);

if (import.meta.env.DEV && typeof window !== "undefined") {
  (
    window as typeof window & { __FARPLANE_OFFICE_WORLD_STORE?: typeof useOfficeWorldStore }
  ).__FARPLANE_OFFICE_WORLD_STORE = useOfficeWorldStore;
}
