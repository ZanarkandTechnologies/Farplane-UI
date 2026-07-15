/**
 * OFFICE CLICK PROBE
 * ==================
 * Dev-only browser automation surface for measuring click target reliability.
 */
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { EmployeeData, OfficeObject, TeamData } from "@/modules/office/lib/types";
import { useAppStore } from "@/store";

type ProbeTargetKind = "employee" | "office-object" | "team";

type ProbeTarget = {
  id: string;
  kind: ProbeTargetKind;
  label: string;
  screen: { x: number; y: number };
  world: [number, number, number];
};

declare global {
  interface Window {
    __farplaneOfficeLiveEmployeePositions?: Record<string, [number, number, number]>;
    __farplaneOfficeClickProbe?: {
      targets: ProbeTarget[];
      state: {
        activeTeamId: string | null;
        isTeamPanelOpen: boolean;
        selectedObjectId: string | null;
      };
      reset: () => void;
      hitTest: (x: number, y: number) => Array<{ name: string; distance: number }>;
    };
  }
}

function projectToScreen(
  point: [number, number, number],
  camera: THREE.Camera,
  size: { width: number; height: number },
): { x: number; y: number } {
  const vector = new THREE.Vector3(...point).project(camera);
  return {
    x: ((vector.x + 1) / 2) * size.width,
    y: ((-vector.y + 1) / 2) * size.height,
  };
}

export function OfficeClickProbe({
  teams,
  employees,
  officeObjects,
}: {
  teams: TeamData[];
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
}) {
  const { camera, size } = useThree();
  const scene = useThree((state) => state.scene);
  const activeTeamId = useAppStore((state) => state.activeTeamId);
  const isTeamPanelOpen = useAppStore((state) => state.isTeamPanelOpen);
  const selectedObjectId = useAppStore((state) => state.selectedObjectId);

  useFrame(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const teamTargets: ProbeTarget[] = teams
      .filter((team) => team._id !== "team-management")
      .map((team) => {
        const world = team.clusterPosition ?? [0, 0, 0];
        return {
          id: String(team._id),
          kind: "team" as const,
          label: team.name,
          world,
          screen: projectToScreen([world[0], world[1] + 0.35, world[2]], camera, size),
        };
      });
    const liveEmployeePositions = window.__farplaneOfficeLiveEmployeePositions ?? {};
    const employeeTargets: ProbeTarget[] = employees.map((employee) => {
      const world = liveEmployeePositions[String(employee._id)] ??
        employee.initialPosition ?? [0, 0, 0];
      return {
        id: String(employee._id),
        kind: "employee" as const,
        label: employee.name,
        world,
        screen: projectToScreen([world[0], world[1] + 0.9, world[2]], camera, size),
      };
    });
    const officeObjectTargets: ProbeTarget[] = officeObjects.map((officeObject) => {
      const world = officeObject.position;
      const displayName = officeObject.metadata?.displayName;
      return {
        id: String(officeObject._id),
        kind: "office-object" as const,
        label: typeof displayName === "string" ? displayName : officeObject.meshType,
        world,
        screen: projectToScreen([world[0], world[1] + 0.8, world[2]], camera, size),
      };
    });
    window.__farplaneOfficeClickProbe = {
      targets: [...teamTargets, ...employeeTargets, ...officeObjectTargets],
      state: {
        activeTeamId: activeTeamId ? String(activeTeamId) : null,
        isTeamPanelOpen,
        selectedObjectId: selectedObjectId ? String(selectedObjectId) : null,
      },
      reset: () => {
        const store = useAppStore.getState();
        store.setActiveTeamId(null);
        store.setIsTeamPanelOpen(false);
        store.setSelectedObjectId(null);
      },
      hitTest: (x: number, y: number) => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(
          new THREE.Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1),
          camera,
        );
        return raycaster
          .intersectObjects(scene.children, true)
          .slice(0, 12)
          .map((hit) => {
            let owner: THREE.Object3D | null = hit.object;
            while (owner && !owner.name) owner = owner.parent;
            return {
              name: owner?.name || hit.object.type,
              distance: Number(hit.distance.toFixed(3)),
            };
          });
      },
    };
  });

  return null;
}
