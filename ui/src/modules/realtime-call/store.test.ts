import { beforeEach, describe, expect, it } from "vitest";
import { useRealtimeCallStore } from "./store";

describe("useRealtimeCallStore", () => {
  beforeEach(() => useRealtimeCallStore.setState({ selectedEmployeeIds: [], isOpen: false }));

  it("toggles unique employee selections", () => {
    const store = useRealtimeCallStore.getState();
    store.toggleEmployee("employee-alpha");
    store.toggleEmployee("employee-beta");
    expect(useRealtimeCallStore.getState().selectedEmployeeIds).toEqual([
      "employee-alpha",
      "employee-beta",
    ]);
    useRealtimeCallStore.getState().toggleEmployee("employee-alpha");
    expect(useRealtimeCallStore.getState().selectedEmployeeIds).toEqual(["employee-beta"]);
  });

  it("opens with normalized ids and preserves selection when reopened without ids", () => {
    useRealtimeCallStore.getState().openCall([" employee-alpha ", "employee-alpha", ""]);
    expect(useRealtimeCallStore.getState()).toMatchObject({
      isOpen: true,
      selectedEmployeeIds: ["employee-alpha"],
    });
    useRealtimeCallStore.getState().closeCall();
    useRealtimeCallStore.getState().openCall();
    expect(useRealtimeCallStore.getState()).toMatchObject({
      isOpen: true,
      selectedEmployeeIds: ["employee-alpha"],
    });
  });
});
