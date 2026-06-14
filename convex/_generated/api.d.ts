/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _utils from "../_utils.js";
import type * as board from "../board.js";
import type * as board_contract from "../board_contract.js";
import type * as board_http_contract from "../board_http_contract.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as modules_agentActivity_contracts from "../modules/agentActivity/contracts.js";
import type * as modules_agentActivity_events from "../modules/agentActivity/events.js";
import type * as modules_agentActivity_httpContracts from "../modules/agentActivity/httpContracts.js";
import type * as modules_agentActivity_status from "../modules/agentActivity/status.js";
import type * as modules_projectArtefacts_artefacts from "../modules/projectArtefacts/artefacts.js";
import type * as modules_resourceBank_analyses from "../modules/resourceBank/analyses.js";
import type * as modules_resourceBank_assets from "../modules/resourceBank/assets.js";
import type * as modules_resourceBank_demo from "../modules/resourceBank/demo.js";
import type * as modules_resourceBank_jobs from "../modules/resourceBank/jobs.js";
import type * as modules_resourceBank_records from "../modules/resourceBank/records.js";
import type * as modules_resourceBank_resourceBank from "../modules/resourceBank/resourceBank.js";
import type * as modules_resourceBank_retrieval from "../modules/resourceBank/retrieval.js";
import type * as modules_resourceBank_skillFindings from "../modules/resourceBank/skillFindings.js";
import type * as modules_resourceBank_validators from "../modules/resourceBank/validators.js";
import type * as modules_runtimeTelemetry_runtimeTelemetry from "../modules/runtimeTelemetry/runtimeTelemetry.js";
import type * as modules_runtimeTelemetry_telemetry from "../modules/runtimeTelemetry/telemetry.js";
import type * as modules_runtimeTelemetry_validators from "../modules/runtimeTelemetry/validators.js";
import type * as modules_skillInvocations_contracts from "../modules/skillInvocations/contracts.js";
import type * as modules_skillInvocations_events from "../modules/skillInvocations/events.js";
import type * as modules_skillInvocations_httpContracts from "../modules/skillInvocations/httpContracts.js";
import type * as modules_skillInvocations_queries from "../modules/skillInvocations/queries.js";
import type * as modules_skillInvocations_validators from "../modules/skillInvocations/validators.js";
import type * as modules_teamBoard_board from "../modules/teamBoard/board.js";
import type * as modules_teamBoard_contracts from "../modules/teamBoard/contracts.js";
import type * as modules_teamBoard_httpContracts from "../modules/teamBoard/httpContracts.js";
import type * as status from "../status.js";
import type * as status_contract from "../status_contract.js";
import type * as status_http_contract from "../status_http_contract.js";
import type * as team_artefacts from "../team_artefacts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _utils: typeof _utils;
  board: typeof board;
  board_contract: typeof board_contract;
  board_http_contract: typeof board_http_contract;
  crons: typeof crons;
  events: typeof events;
  http: typeof http;
  "modules/agentActivity/contracts": typeof modules_agentActivity_contracts;
  "modules/agentActivity/events": typeof modules_agentActivity_events;
  "modules/agentActivity/httpContracts": typeof modules_agentActivity_httpContracts;
  "modules/agentActivity/status": typeof modules_agentActivity_status;
  "modules/projectArtefacts/artefacts": typeof modules_projectArtefacts_artefacts;
  "modules/resourceBank/analyses": typeof modules_resourceBank_analyses;
  "modules/resourceBank/assets": typeof modules_resourceBank_assets;
  "modules/resourceBank/demo": typeof modules_resourceBank_demo;
  "modules/resourceBank/jobs": typeof modules_resourceBank_jobs;
  "modules/resourceBank/records": typeof modules_resourceBank_records;
  "modules/resourceBank/resourceBank": typeof modules_resourceBank_resourceBank;
  "modules/resourceBank/retrieval": typeof modules_resourceBank_retrieval;
  "modules/resourceBank/skillFindings": typeof modules_resourceBank_skillFindings;
  "modules/resourceBank/validators": typeof modules_resourceBank_validators;
  "modules/runtimeTelemetry/runtimeTelemetry": typeof modules_runtimeTelemetry_runtimeTelemetry;
  "modules/runtimeTelemetry/telemetry": typeof modules_runtimeTelemetry_telemetry;
  "modules/runtimeTelemetry/validators": typeof modules_runtimeTelemetry_validators;
  "modules/skillInvocations/contracts": typeof modules_skillInvocations_contracts;
  "modules/skillInvocations/events": typeof modules_skillInvocations_events;
  "modules/skillInvocations/httpContracts": typeof modules_skillInvocations_httpContracts;
  "modules/skillInvocations/queries": typeof modules_skillInvocations_queries;
  "modules/skillInvocations/validators": typeof modules_skillInvocations_validators;
  "modules/teamBoard/board": typeof modules_teamBoard_board;
  "modules/teamBoard/contracts": typeof modules_teamBoard_contracts;
  "modules/teamBoard/httpContracts": typeof modules_teamBoard_httpContracts;
  status: typeof status;
  status_contract: typeof status_contract;
  status_http_contract: typeof status_http_contract;
  team_artefacts: typeof team_artefacts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
