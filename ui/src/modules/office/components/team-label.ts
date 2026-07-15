/** Pure visibility policy for persistent team signage in the spatial office. */

export function shouldShowTeamLabel(teamName: string): boolean {
  return teamName !== "Management" && teamName !== "CEO";
}
