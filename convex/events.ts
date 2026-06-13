// Compatibility entrypoint: keep existing internal.events.* references stable while agent activity writes are module-owned.
export { clearStaleEvents, ingestEvent, reportStatus } from "./modules/agentActivity/events";
