import { describe, expect, it } from "vitest";

import { TOTAL_HEIGHT } from "@/constants";
import {
  hasActiveEmployeeThread,
  hasEmployeeDeskTargetChanged,
  shouldEmployeeRouteToDesk,
  shouldManualControlOverride,
  shouldSnapEmployeeToUpdatedDeskTarget,
  toEmployeeDeskTarget,
} from "./employee-locomotion-targets";

describe("employee locomotion targets", () => {
  it("normalizes assigned desk targets to avatar ground height", () => {
    expect(toEmployeeDeskTarget([4, 99, -2])).toEqual([4, TOTAL_HEIGHT / 2, -2]);
  });

  it("detects meaningful desk target changes", () => {
    expect(hasEmployeeDeskTargetChanged([1, 0.5, 2], [1.0002, 0.5, 2.0002])).toBe(false);
    expect(hasEmployeeDeskTargetChanged([1, 0.5, 2], [2, 0.5, 2])).toBe(true);
  });

  it("routes active employees to desks while leaving idle fixed-station employees free", () => {
    expect(
      shouldEmployeeRouteToDesk({
        hasActivityTarget: false,
        heartbeatState: "running",
        wantsToWander: true,
      }),
    ).toBe(true);
    expect(
      shouldEmployeeRouteToDesk({
        hasActivityTarget: false,
        heartbeatState: "idle",
        wantsToWander: true,
      }),
    ).toBe(false);
    expect(
      shouldEmployeeRouteToDesk({
        hasActivityTarget: false,
        heartbeatState: "idle",
        wantsToWander: false,
      }),
    ).toBe(false);
  });

  it("lets manual control override autonomous route sources only with a destination", () => {
    expect(
      shouldManualControlOverride({
        isControlled: true,
        destination: [4, TOTAL_HEIGHT / 2, -2],
      }),
    ).toBe(true);
    expect(shouldManualControlOverride({ isControlled: true, destination: null })).toBe(false);
    expect(
      shouldManualControlOverride({
        isControlled: false,
        destination: [4, TOTAL_HEIGHT / 2, -2],
      }),
    ).toBe(false);
  });

  it("treats idle and no-work heartbeat states as free for ambient wandering", () => {
    expect(hasActiveEmployeeThread({ heartbeatState: "idle", isBusy: true })).toBe(false);
    expect(hasActiveEmployeeThread({ heartbeatState: "no_work", isBusy: true })).toBe(false);
    expect(hasActiveEmployeeThread({ heartbeatState: "executing", isBusy: false })).toBe(true);
    expect(hasActiveEmployeeThread({ heartbeatState: "done", isBusy: false })).toBe(true);
    expect(hasActiveEmployeeThread({ isBusy: true })).toBe(true);
  });

  it("snaps only avatars still standing at the previous desk target", () => {
    const previousDeskTarget: [number, number, number] = [2, 0.5, 3];
    const nextDeskTarget: [number, number, number] = [8, 0.5, -1];

    expect(
      shouldSnapEmployeeToUpdatedDeskTarget({
        currentPosition: [2.1, 0.5, 3.05],
        previousDeskTarget,
        nextDeskTarget,
      }),
    ).toBe(true);
    expect(
      shouldSnapEmployeeToUpdatedDeskTarget({
        currentPosition: [5, 0.5, 5],
        previousDeskTarget,
        nextDeskTarget,
      }),
    ).toBe(false);
  });
});
