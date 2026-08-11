import { Box } from "@react-three/drei";
import type React from "react";

import { COMPUTER_HEIGHT } from "@/constants";

type DeskMonitorProps = {
  name?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
};

/**
 * The monitor used by every ordinary desk. Keeping it as one primitive stops
 * special furniture (such as the Project Council) from drifting into a
 * separate visual language.
 */
export function DeskMonitor({
  name = "desk-monitor",
  position,
  rotation = [0, 0, 0],
}: DeskMonitorProps): React.JSX.Element {
  return (
    <group name={name} position={position} rotation={rotation}>
      <Box args={[0.5, COMPUTER_HEIGHT, 0.05]} position={[0, COMPUTER_HEIGHT / 2, 0]} castShadow>
        <meshStandardMaterial color="black" />
      </Box>
      <Box args={[0.2, 0.05, 0.2]} position={[0, 0.025, 0]} castShadow>
        <meshStandardMaterial color="darkgrey" />
      </Box>
    </group>
  );
}
