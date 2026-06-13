// Compatibility entrypoint: keep existing api.team_artefacts.* references stable while project artefacts are module-owned.
export { listProjectArtefactIndex, syncProjectArtefactIndex } from "./modules/projectArtefacts/artefacts";
