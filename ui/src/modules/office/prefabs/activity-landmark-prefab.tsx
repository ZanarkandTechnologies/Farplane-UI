/** Builder placement preview for native activity landmark prop clusters. */
import type { GameObjectDefinition } from "../definitions";
import { ActivityLandmarkVisual } from "../components/activity-landmark";

export const ActivityLandmarkPrefab: GameObjectDefinition = {
  id: "activity-landmark",
  displayName: "Activity Landmark",
  Ghost: () => <ActivityLandmarkVisual kind="gym" />,
  placement: {
    type: "coordinate",
    confirmMessage: "Place activity landmark here?",
    behaviorId: "place_generic",
  },
};
