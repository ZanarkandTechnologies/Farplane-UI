// Compatibility entrypoint: keep existing api.board.* references stable while team board logic lives under convex/modules/teamBoard.
export {
  boardCommand,
  getCompanyBoardTasks,
  getNextTaskCandidates,
  getProjectActivity,
  getProjectBoard,
  getProjectBoardEvents,
  getTeamTimeline,
} from "./modules/teamBoard/board";
