import {
  BrainCircuit,
  Building2,
  Handshake,
  HeartHandshake,
  Landmark,
  type LucideIcon,
  Megaphone,
  RadioTower,
  Settings2,
  Table2,
  Target,
} from "lucide-react";
import type { ReactElement } from "react";
import type { PositionedSkillNode } from "./skill-os-types";

const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  "back-office": Landmark,
  customer: HeartHandshake,
  deals: Handshake,
  intelligence: BrainCircuit,
  marketing: Megaphone,
  operations: Settings2,
  sales: Target,
};

export function splitCapabilityLabel(label: string): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || label.length < 15) return [label];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = `${line} ${word}`.trim();
    if (line && next.length > 18 && lines.length < 2) {
      lines.push(line);
      line = word;
      continue;
    }
    line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function hexagonPath(radius: number): string {
  return `${Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    const command = index === 0 ? "M" : "L";
    return `${command} ${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ")} Z`;
}

function CapabilityNodeIcon({
  node,
  size,
  stroke,
}: {
  node: PositionedSkillNode;
  size: number;
  stroke: string;
}): ReactElement {
  const departmentId = node.department_id ?? node.group ?? node.id.replace(/^department:/, "");
  const Icon =
    node.kind === "department"
      ? (DEPARTMENT_ICONS[departmentId] ?? Building2)
      : node.kind === "facility"
        ? RadioTower
        : Table2;
  return (
    <Icon
      aria-hidden="true"
      className="pointer-events-none"
      color={stroke}
      size={size}
      strokeWidth={2.3}
      x={-size / 2}
      y={-size / 2}
    />
  );
}

export function CapabilityNodeGlyph({
  node,
  opacity,
  selected,
  stroke,
}: {
  node: PositionedSkillNode;
  opacity: number;
  selected: boolean;
  stroke: string;
}): ReactElement {
  const radius = node.radius;
  const fill = "hsl(var(--background))";
  const strokeWidth = selected ? 3.2 : node.kind === "department" ? 2.35 : 1.7;
  const iconSize = Math.max(8, Math.min(18, radius * 1.15));
  const shapeProps = {
    fill,
    opacity,
    stroke,
    strokeWidth,
  };

  return (
    <>
      {node.kind === "department" ? (
        <rect
          fill={stroke}
          height={(radius + 8) * 2}
          opacity={opacity * 0.08}
          rx={6}
          width={(radius + 8) * 2}
          x={-radius - 8}
          y={-radius - 8}
        />
      ) : null}
      {node.kind === "department" ? (
        <rect
          height={radius * 2}
          rx={4}
          width={radius * 2}
          x={-radius}
          y={-radius}
          {...shapeProps}
        />
      ) : node.kind === "facility" ? (
        <path d={hexagonPath(radius)} strokeLinejoin="round" {...shapeProps} />
      ) : (
        <rect
          height={radius * 2}
          rx={Math.max(3, radius * 0.34)}
          width={radius * 2.35}
          x={-radius * 1.175}
          y={-radius}
          {...shapeProps}
        />
      )}
      <CapabilityNodeIcon node={node} size={iconSize} stroke={stroke} />
    </>
  );
}
