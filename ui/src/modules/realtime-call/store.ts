/**
 * Ownership: global selection/open state for the realtime-call module.
 * Inputs/outputs: employee ids and dialog actions; no persistence or network side effects.
 * Invariant: selected ids are ordered, unique, non-empty strings.
 */
import { create } from "zustand";

interface RealtimeCallState {
  selectedEmployeeIds: string[];
  isOpen: boolean;
  toggleEmployee: (id: string) => void;
  selectOnly: (id: string) => void;
  clearSelection: () => void;
  openCall: (ids?: string[]) => void;
  closeCall: () => void;
}

function normalizeIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export const useRealtimeCallStore = create<RealtimeCallState>((set) => ({
  selectedEmployeeIds: [],
  isOpen: false,
  toggleEmployee: (id) =>
    set((state) => {
      const normalized = id.trim();
      if (!normalized) return state;
      return {
        selectedEmployeeIds: state.selectedEmployeeIds.includes(normalized)
          ? state.selectedEmployeeIds.filter((candidate) => candidate !== normalized)
          : [...state.selectedEmployeeIds, normalized],
      };
    }),
  selectOnly: (id) => set({ selectedEmployeeIds: normalizeIds([id]) }),
  clearSelection: () => set({ selectedEmployeeIds: [] }),
  openCall: (ids) =>
    set((state) => ({
      isOpen: true,
      selectedEmployeeIds: ids === undefined ? state.selectedEmployeeIds : normalizeIds(ids),
    })),
  closeCall: () => set({ isOpen: false }),
}));
