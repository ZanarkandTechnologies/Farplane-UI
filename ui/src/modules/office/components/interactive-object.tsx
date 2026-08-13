import { Html } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { Move, Settings, SlidersVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OFFICE_INTERACTION_COLORS } from "@/config/office-theme";
import { OFFICE_HTML_Z } from "@/lib/z-index";
import {
  canPlaceOfficeObjectAtPosition,
  constrainOfficeObjectPositionForLayout,
} from "@/modules/office/components/office-object-placement";
import { persistOfficeKitCustomization } from "@/modules/office/lib/office-kit";
import type { OfficeId } from "@/modules/office/lib/types";
import { useOfficeRuntimeAdapter } from "@/modules/runtime";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";
import { DraggableController } from "../controllers/draggable-controller";
import { useDeleteOfficeObject } from "../hooks/use-delete-office-object";
import {
  buildOfficeObjectRuntimeLaunch,
  parseOfficeObjectInteractionConfig,
} from "../office-object-ui";
import { useOfficeInternalPanelLauncher } from "../panels/use-internal-panel-launcher";
import { beginObjectInteractionTrace } from "../utils/object-interaction-perf";
import { ContextMenu, type MenuAction } from "./context-menu";
import { getBuilderClickAction } from "./interactive-object.builder";
import {
  DEFAULT_INTERACTIVE_OBJECT_POSITION,
  DEFAULT_INTERACTIVE_OBJECT_ROTATION,
  DEFAULT_INTERACTIVE_OBJECT_SCALE,
  syncTuple3,
} from "./interactive-object-vectors";
import { resolvePersistedOfficeObjectId } from "./office-object-id";
import { refreshOfficeDataSafely } from "./office-object-refresh";

const HOVER_LABEL_Y_POSITION_MULTIPLIER = 1.5;

interface InteractiveObjectProps {
  children: React.ReactNode;
  objectId: OfficeId<"officeObjects">;
  objectType: string;
  companyId?: OfficeId<"companies">;
  initialPosition?: [number, number, number];
  initialRotation?: [number, number, number];
  initialScale?: [number, number, number];
  showHoverEffect?: boolean;
  hoverLabel?: string | null;
  customActions?: MenuAction[];
  onSettings?: () => void;
  metadata?: Record<string, unknown>;
  supportsScaling?: boolean;
  allowDelete?: boolean;
  allowRotation?: boolean;
  allowSettings?: boolean;
  allowTransform?: boolean;
  externalGroupRef?:
    | React.MutableRefObject<THREE.Group | null>
    | ((element: THREE.Group | null) => void);
  interactionBounds?: {
    center: [number, number, number];
    size: [number, number, number];
    highlightRadius: number;
  };
}

export function getRuntimeHoverLabel(
  config: ReturnType<typeof parseOfficeObjectInteractionConfig>,
): string | null {
  switch (config.uiBinding.kind) {
    case "embed":
    case "skillShelf":
    case "documentLibrary":
    case "internalPanel":
      return config.uiBinding.title;
    default:
      return null;
  }
}

/**
 * INTERACTIVE OBJECT
 * ==================
 * Unified component for selectable, draggable 3D office objects.
 *
 * KEY CONCEPTS:
 * - Builder-mode selection keeps the scene menu lean and routes exact transforms into the shared panel on demand.
 * - Persisted office-object writes stay in this component; builder HUD panels trigger the higher-level flows.
 *
 * USAGE:
 * - Wrap office furniture/custom meshes that need builder interactions.
 * - Pass runtime `metadata` so embed-bound objects can open their routed viewer outside builder mode.
 *
 * MEMORY REFERENCES:
 * - MEM-0187
 * - MEM-0188
 * - MEM-0189
 */
export function InteractiveObject({
  children,
  objectId,
  objectType,
  companyId,
  initialPosition = DEFAULT_INTERACTIVE_OBJECT_POSITION,
  initialRotation = DEFAULT_INTERACTIVE_OBJECT_ROTATION,
  initialScale = DEFAULT_INTERACTIVE_OBJECT_SCALE,
  showHoverEffect = true,
  hoverLabel,
  customActions,
  onSettings,
  metadata,
  allowSettings = true,
  allowTransform = true,
  allowDelete = true,
  externalGroupRef,
  interactionBounds,
}: InteractiveObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const controllerRef = useRef<DraggableController | null>(null);
  const { camera, gl } = useThree();
  const adapter = useOfficeRuntimeAdapter();
  const { officeObjects, officeSettings, refresh } = useOfficeDataContext();
  const objectIdString = `object-${objectId}`;
  const [localPosition, setLocalPosition] = useState<[number, number, number]>(initialPosition);
  const [localRotation, setLocalRotation] = useState<[number, number, number]>(initialRotation);
  const [localScale, setLocalScale] = useState<[number, number, number]>(initialScale);
  const [isHovered, setIsHovered] = useState(false);
  const [isLocallyDragging, setIsLocallyDragging] = useState(false);
  const [highlightRadius, setHighlightRadius] = useState(1.1);
  const [hoverLabelYOffset, setHoverLabelYOffset] = useState(1.35);
  const lastConfirmedPositionRef = useRef<[number, number, number]>(initialPosition);
  const lastConfirmedRotationRef = useRef<[number, number, number]>(initialRotation);
  const lastConfirmedScaleRef = useRef<[number, number, number]>(initialScale);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const isDragEnabled = isBuilderMode && !!companyId;
  const setGlobalDragging = useAppStore((state) => state.setIsDragging);
  const isSelected = useAppStore((state) => state.selectedObjectId === objectIdString);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const setActiveObjectConfigId = useAppStore((state) => state.setActiveObjectConfigId);
  const setActiveObjectTransformId = useAppStore((state) => state.setActiveObjectTransformId);
  const setActiveObjectPanel = useAppStore((state) => state.setActiveObjectPanel);
  const activeObjectConfigId = useAppStore((state) => state.activeObjectConfigId);
  const launchInternalPanel = useOfficeInternalPanelLauncher();

  const interactionConfig = useMemo(() => parseOfficeObjectInteractionConfig(metadata), [metadata]);
  const formattedName = useMemo(
    () =>
      objectType
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    [objectType],
  );
  const objectTitle = interactionConfig.displayName ?? formattedName;
  const runtimeHoverLabel =
    hoverLabel === undefined ? getRuntimeHoverLabel(interactionConfig) : hoverLabel;
  const setGroupRef = useCallback(
    (element: THREE.Group | null) => {
      groupRef.current = element;
      if (externalGroupRef) {
        if (typeof externalGroupRef === "function") {
          externalGroupRef(element);
        } else {
          externalGroupRef.current = element;
        }
      }
    },
    [externalGroupRef],
  );

  const persistOfficeObject = useCallback(
    async (input: {
      id: string;
      position: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      metadata?: Record<string, unknown>;
    }): Promise<void> => {
      const current = await adapter.getOfficeObjects();
      const knownIds = new Set(current.map((item) => item.id));
      const persistedId = resolvePersistedOfficeObjectId(input.id, knownIds);
      const existing = current.find((item) => item.id === persistedId);
      const payload = {
        id: persistedId,
        identifier: existing?.identifier ?? persistedId,
        meshType: (existing?.meshType ?? objectType) as
          | "team-cluster"
          | "plant"
          | "couch"
          | "bookshelf"
          | "pantry"
          | "glass-wall"
          | "office-divider"
          | "custom-mesh",
        position: input.position,
        rotation: input.rotation ?? existing?.rotation ?? initialRotation,
        scale: input.scale ?? existing?.scale ?? initialScale,
        metadata: input.metadata ?? existing?.metadata ?? metadata ?? {},
      };
      const result = await adapter.upsertOfficeObject(payload, { currentObjects: current });
      if (!result.ok) {
        throw new Error(result.error ?? "office_object_update_failed");
      }
      await persistOfficeKitCustomization(adapter);
      lastConfirmedPositionRef.current = input.position;
      lastConfirmedRotationRef.current = payload.rotation;
      lastConfirmedScaleRef.current = payload.scale ?? initialScale;
      await refreshOfficeDataSafely(refresh);
    },
    [adapter, initialRotation, initialScale, metadata, objectType, refresh],
  );

  const createDragController = useCallback((): DraggableController | null => {
    if (!groupRef.current || !isDragEnabled) return null;
    const handleDragEnd = async (newPosition: THREE.Vector3) => {
      const newPosArray: [number, number, number] = [newPosition.x, newPosition.y, newPosition.z];
      setLocalPosition(newPosArray);

      try {
        await persistOfficeObject({
          id: String(objectId),
          position: newPosArray,
        });
      } catch (error) {
        console.error(`Failed to update ${objectId} position:`, error);
        setLocalPosition(lastConfirmedPositionRef.current);
      }
    };

    const handleDragStateChange = (dragging: boolean) => {
      setIsLocallyDragging(dragging);
      setGlobalDragging(dragging);
    };

    return new DraggableController(
      groupRef.current,
      camera,
      gl.domElement,
      handleDragEnd,
      handleDragStateChange,
      (position) => {
        const constrained = constrainOfficeObjectPositionForLayout(
          [position.x, position.y, position.z],
          officeSettings.officeLayout,
          objectType,
        );
        if (
          !canPlaceOfficeObjectAtPosition({
            position: constrained,
            layout: officeSettings.officeLayout,
            meshType: objectType,
            officeObjects,
            metadata,
            rotation: localRotation,
            ignoreObjectId: String(objectId),
          })
        ) {
          return new THREE.Vector3(...lastConfirmedPositionRef.current);
        }
        return new THREE.Vector3(...constrained);
      },
    );
  }, [
    camera,
    gl.domElement,
    isDragEnabled,
    localRotation,
    metadata,
    objectId,
    objectType,
    officeObjects,
    officeSettings.officeLayout,
    persistOfficeObject,
    setGlobalDragging,
  ]);

  useEffect(() => {
    if (isDragEnabled) return;
    controllerRef.current?.destroy();
    controllerRef.current = null;
  }, [isDragEnabled]);

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isLocallyDragging && groupRef.current) {
      groupRef.current.position.set(...localPosition);
    }
  }, [localPosition, isLocallyDragging]);

  useEffect(() => {
    setLocalPosition((currentPosition) => syncTuple3(currentPosition, initialPosition));
    lastConfirmedPositionRef.current = initialPosition;
  }, [initialPosition]);

  useEffect(() => {
    setLocalRotation((currentRotation) => syncTuple3(currentRotation, initialRotation));
    lastConfirmedRotationRef.current = initialRotation;
  }, [initialRotation]);

  useEffect(() => {
    setLocalScale((currentScale) => syncTuple3(currentScale, initialScale));
    lastConfirmedScaleRef.current = initialScale;
  }, [initialScale]);

  useEffect(() => {
    if (!isBuilderMode && isSelected) {
      setSelectedObjectId(null);
    }
    if (!isBuilderMode) {
      setActiveObjectTransformId(null);
    }
  }, [isBuilderMode, isSelected, setActiveObjectTransformId, setSelectedObjectId]);

  useEffect(() => {
    if (activeObjectConfigId !== objectId) return;
    setIsHovered(false);
  }, [activeObjectConfigId, objectId]);

  useEffect(() => {
    if (interactionBounds) {
      setHighlightRadius(interactionBounds.highlightRadius);
      setHoverLabelYOffset(interactionBounds.center[1] + interactionBounds.size[1] / 2 + 0.35);
      return;
    }
    if (!contentRef.current) return;
    const bounds = new THREE.Box3().setFromObject(contentRef.current);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    setHighlightRadius(Math.max(0.85, Math.max(size.x, size.z) * 0.55));
    setHoverLabelYOffset(Math.max(1.1, size.y + 0.35));
  }, [interactionBounds]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (isLocallyDragging) return;
      e.stopPropagation();
      if (!isBuilderMode) {
        const openedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        const runtimeLaunch = buildOfficeObjectRuntimeLaunch({
          objectId,
          config: interactionConfig,
          openedAtMs,
        });
        if (runtimeLaunch?.kind === "internalPanel") {
          beginObjectInteractionTrace("runtime-panel", String(objectId), {
            title: runtimeLaunch.title,
          });
          if (import.meta.env.DEV) {
            console.debug("[perf] office-object-modal-click", {
              objectId: String(objectId),
              title: runtimeLaunch.title,
              kind: runtimeLaunch.kind,
              panelId: runtimeLaunch.panelId,
              openedAtMs,
            });
          }
          launchInternalPanel(runtimeLaunch.panelId);
          return;
        }
        if (runtimeLaunch?.kind === "objectPanel") {
          beginObjectInteractionTrace("runtime-panel", String(objectId), {
            title: runtimeLaunch.panel.title,
          });
          if (import.meta.env.DEV) {
            console.debug("[perf] office-object-modal-click", {
              objectId: String(objectId),
              title: runtimeLaunch.panel.title,
              kind: runtimeLaunch.panel.kind,
              openedAtMs,
            });
          }
          setActiveObjectPanel(runtimeLaunch.panel);
        }
        return;
      }

      const clickAction = getBuilderClickAction({ isSelected, allowSettings });
      if (clickAction === "open-config") {
        beginObjectInteractionTrace("builder-panel", String(objectId), { source: "repeat-click" });
        setSelectedObjectId(null);
        setActiveObjectTransformId(null);
        setActiveObjectConfigId(objectId);
        return;
      }
      if (clickAction === "clear-selection") {
        setSelectedObjectId(null);
        setActiveObjectTransformId(null);
        return;
      }

      beginObjectInteractionTrace("builder-menu", String(objectId), { source: "click" });
      setSelectedObjectId(objectIdString);
    },
    [
      allowSettings,
      interactionConfig,
      launchInternalPanel,
      setActiveObjectConfigId,
      setActiveObjectTransformId,
      isBuilderMode,
      isLocallyDragging,
      isSelected,
      objectId,
      objectIdString,
      setActiveObjectPanel,
      setSelectedObjectId,
    ],
  );

  const handleMoveMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isDragEnabled) return;
      controllerRef.current?.destroy();
      controllerRef.current = createDragController();
      controllerRef.current?.startDrag(e.nativeEvent);
    },
    [createDragController, isDragEnabled],
  );

  const handleSettings = useCallback(() => {
    if (onSettings) {
      onSettings();
      return;
    }
    beginObjectInteractionTrace("builder-panel", String(objectId), { source: "settings" });
    setSelectedObjectId(null);
    setActiveObjectTransformId(null);
    setActiveObjectConfigId(objectId);
  }, [
    objectId,
    onSettings,
    setActiveObjectConfigId,
    setActiveObjectTransformId,
    setSelectedObjectId,
  ]);

  const handleTransform = useCallback(() => {
    beginObjectInteractionTrace("builder-panel", String(objectId), { source: "transform" });
    setActiveObjectConfigId(null);
    setActiveObjectTransformId(objectId);
  }, [objectId, setActiveObjectConfigId, setActiveObjectTransformId]);

  const { deleteObject } = useDeleteOfficeObject(objectId);

  const actions: MenuAction[] = useMemo(
    () =>
      customActions || [
        {
          id: "move",
          label: "Move",
          icon: Move,
          color: "blue",
          position: "top",
          onClick: () => {},
          onMouseDown: handleMoveMouseDown,
        },
        ...(allowSettings
          ? ([
              {
                id: "settings",
                label: "Settings",
                icon: Settings,
                color: "gray",
                position: "right",
                onClick: handleSettings,
              },
            ] satisfies MenuAction[])
          : []),
        ...(allowTransform
          ? ([
              {
                id: "transform",
                label: "Transform",
                icon: SlidersVertical,
                color: "indigo",
                position: "left",
                onClick: handleTransform,
              },
            ] satisfies MenuAction[])
          : []),
        ...(allowDelete
          ? ([
              {
                id: "delete",
                label: "Delete",
                icon: Trash2,
                color: "red",
                position: "bottom",
                onClick: () => void deleteObject(),
              },
            ] satisfies MenuAction[])
          : []),
      ],
    [
      customActions,
      handleMoveMouseDown,
      handleSettings,
      handleTransform,
      deleteObject,
      allowSettings,
      allowTransform,
      allowDelete,
    ],
  );

  const highlightColor = isSelected
    ? OFFICE_INTERACTION_COLORS.selectionEdge
    : OFFICE_INTERACTION_COLORS.hoverEdge;
  const showInteractionHighlight = showHoverEffect && (isHovered || isSelected);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: React Three Fiber group handles scene pointer events, not DOM interaction semantics.
    <group
      ref={setGroupRef}
      name={`office-object:${String(objectId)}`}
      position={localPosition}
      rotation={localRotation}
      scale={localScale}
      onClick={handleClick}
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (import.meta.env.DEV && interactionConfig.uiBinding.kind === "embed") {
          console.debug("[office-object] pointer-enter", {
            objectId: String(objectId),
            objectType,
            title: interactionConfig.uiBinding.title,
            highlightRadius,
            scale: localScale,
            interactionBounds,
          });
        }
        setIsHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setIsHovered(false);
      }}
    >
      {interactionBounds ? (
        <mesh position={interactionBounds.center}>
          <boxGeometry args={interactionBounds.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}

      <group ref={contentRef}>{children}</group>

      {showInteractionHighlight && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <ringGeometry args={[highlightRadius * 0.78, highlightRadius, 32]} />
          <meshBasicMaterial
            color={highlightColor}
            transparent
            opacity={isSelected ? 0.45 : 0.28}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {showHoverEffect && isHovered && runtimeHoverLabel ? (
        <Html
          center
          distanceFactor={9}
          position={[0, hoverLabelYOffset * HOVER_LABEL_Y_POSITION_MULTIPLIER, 0]}
          sprite
          transform
          zIndexRange={OFFICE_HTML_Z.label}
        >
          <div className="pointer-events-none max-w-[220px] rounded-md border border-border/70 bg-background/95 px-2.5 py-1.5 text-center text-xs font-medium text-foreground shadow-lg backdrop-blur">
            <span className="block truncate">{runtimeHoverLabel}</span>
          </div>
        </Html>
      ) : null}

      {isLocallyDragging && (
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 32]} />
          <meshBasicMaterial
            color={OFFICE_INTERACTION_COLORS.dragIndicator}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <ContextMenu
        isOpen={isBuilderMode && isSelected && activeObjectConfigId !== objectId}
        onClose={() => {
          setSelectedObjectId(null);
          setActiveObjectTransformId(null);
        }}
        actions={actions}
        title={objectTitle}
        perfObjectId={String(objectId)}
      />
    </group>
  );
}
