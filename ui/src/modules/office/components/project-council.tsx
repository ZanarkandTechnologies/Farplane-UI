/** Presentation-only Council table around the Company World Nexus. */

import type React from "react";
import type { ProjectCouncilLayout } from "../lib/project-council-layout";
import { solveRoundTeamTableLayout } from "../utils/layout";
import RoundTeamTable from "./round-team-table";

const COUNCIL_TABLE_EDGE_INSET = 0.95;
const COUNCIL_TABLE_MIN_RADIUS = 4.35;
const BASE_TABLE_RADIUS = 1.95;

function getCouncilTableScale(layout: ProjectCouncilLayout): number {
  const targetRadius = Math.max(
    COUNCIL_TABLE_MIN_RADIUS,
    layout.council.radius - COUNCIL_TABLE_EDGE_INSET,
  );
  return (
    targetRadius /
    Math.max(BASE_TABLE_RADIUS, solveRoundTeamTableLayout(layout.sectors.length).radius)
  );
}

export function ProjectCouncil({
  layout,
}: {
  layout: ProjectCouncilLayout;
}): React.JSX.Element | null {
  if (layout.sectors.length === 0) return null;
  const firstSector = layout.sectors[0];
  const tableRotationY = firstSector ? firstSector.angle - Math.PI / 2 : 0;
  const tableScale = getCouncilTableScale(layout);
  return (
    <group
      name="project-council"
      position={[layout.council.center[0], 0, layout.council.center[2]]}
    >
      <group name="project-council-white-round-table" rotation={[0, tableRotationY, 0]}>
        <RoundTeamTable
          stationCount={layout.sectors.length}
          isHovered={false}
          variant="executive"
          finish="ivory"
          showExecutiveNexus={false}
          planarScale={tableScale}
        />
      </group>
    </group>
  );
}
