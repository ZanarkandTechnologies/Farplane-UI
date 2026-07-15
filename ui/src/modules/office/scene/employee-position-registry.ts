/**
 * EMPLOYEE POSITION REGISTRY
 * ==========================
 * Exposes mounted locomotion positions to camera/effect consumers without React churn.
 * Entries are lifecycle-bounded and callers receive copies rather than mutable scene vectors.
 */

const livePositions = new Map<string, [number, number, number]>();

export function setLiveEmployeePosition(
  employeeId: string,
  position: { x: number; y: number; z: number },
): void {
  livePositions.set(employeeId, [position.x, position.y, position.z]);
}

export function removeLiveEmployeePosition(employeeId: string): void {
  livePositions.delete(employeeId);
}

export function getLiveEmployeePosition(employeeId: string): [number, number, number] | null {
  const position = livePositions.get(employeeId);
  return position ? [...position] : null;
}
