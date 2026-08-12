/**
 * SVG-only routing for canonical capability edges.
 *
 * Bends are presentation points, never graph nodes or workflow stages.
 */

export function capabilityEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  renderKey: string,
): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 42) return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;

  const seed = [...renderKey].reduce((total, character) => total + character.charCodeAt(0), 0);
  const direction = Math.sign(dx) || (seed % 2 === 0 ? 1 : -1);
  const bend = Math.min(34, Math.max(13, distance * 0.075)) + (seed % 3) * 5;
  const first = {
    x: source.x + direction * bend,
    y: source.y + dy * 0.28,
  };
  const second = {
    x: target.x - direction * bend * 0.72,
    y: source.y + dy * 0.73,
  };
  return `M ${source.x} ${source.y} L ${first.x} ${first.y} L ${second.x} ${second.y} L ${target.x} ${target.y}`;
}
