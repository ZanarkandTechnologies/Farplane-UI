/** Pure visibility policy for persistent team signage in the spatial office. */

export const TEAM_LABEL_DISTANCE_FACTOR = 5.2;
export const COMMAND_TEAM_LABEL_DISTANCE_FACTOR = 4.8;

export function shouldShowTeamLabel(teamName: string): boolean {
  return teamName !== "Management" && teamName !== "CEO";
}

export function getTeamLabelDistanceFactor(isCommandNeighborhood: boolean): number {
  return isCommandNeighborhood ? COMMAND_TEAM_LABEL_DISTANCE_FACTOR : TEAM_LABEL_DISTANCE_FACTOR;
}
