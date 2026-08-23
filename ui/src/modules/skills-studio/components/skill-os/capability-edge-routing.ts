/**
 * SVG-only routing for canonical capability edges.
 *
 * The curve is presentation only: the source and target remain the only
 * graph facts. Its outward bow borrows the Department -> World Nexus visual
 * grammar without introducing a workflow stage between them.
 */

export function capabilityEdgePath(
  source: { radius?: number; x: number; y: number },
  target: { radius?: number; x: number; y: number },
  renderKey: string,
): string {
  const rawDx = target.x - source.x;
  const rawDy = target.y - source.y;
  const rawDistance = Math.hypot(rawDx, rawDy);
  const unit = rawDistance ? { x: rawDx / rawDistance, y: rawDy / rawDistance } : { x: 0, y: 0 };
  const startInset = source.radius ? source.radius + 3 : 0;
  const endInset = target.radius ? target.radius + 7 : 0;
  const start = { x: source.x + unit.x * startInset, y: source.y + unit.y * startInset };
  const end = { x: target.x - unit.x * endInset, y: target.y - unit.y * endInset };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 42) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  // Give siblings a deterministic, gentle separation while keeping the
  // department and its admitted capability as the only visible endpoints.
  const seed = [...renderKey].reduce((total, character) => total + character.charCodeAt(0), 0);
  const outward = Math.sign(dx) || (seed % 2 === 0 ? 1 : -1);
  const perpendicular = { x: -dy / distance, y: dx / distance };
  const bend = Math.min(68, Math.max(26, distance * 0.18)) + (seed % 3) * 4;
  const control = {
    x: (start.x + end.x) / 2 + perpendicular.x * bend * outward,
    y: (start.y + end.y) / 2 + perpendicular.y * bend * outward,
  };
  return `M ${start.x} ${start.y} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x} ${end.y}`;
}
