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
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as modules_agentActivity_contracts from "../modules/agentActivity/contracts.js";
import type * as modules_agentActivity_events from "../modules/agentActivity/events.js";
import type * as modules_agentActivity_httpContracts from "../modules/agentActivity/httpContracts.js";
import type * as modules_agentActivity_status from "../modules/agentActivity/status.js";
import type * as modules_content_discoveries from "../modules/content/discoveries.js";
import type * as modules_content_identifiers from "../modules/content/identifiers.js";
import type * as modules_content_intelligenceProjection from "../modules/content/intelligenceProjection.js";
import type * as modules_content_intelligenceProjectionModel from "../modules/content/intelligenceProjectionModel.js";
import type * as modules_content_migrations from "../modules/content/migrations.js";
import type * as modules_content_records from "../modules/content/records.js";
import type * as modules_content_saves from "../modules/content/saves.js";
import type * as modules_content_timeline from "../modules/content/timeline.js";
import type * as modules_content_timelineMigrations from "../modules/content/timelineMigrations.js";
import type * as modules_content_timelineProjection from "../modules/content/timelineProjection.js";
import type * as modules_hookTelemetry_events from "../modules/hookTelemetry/events.js";
import type * as modules_hookTelemetry_farplaneFileEvents from "../modules/hookTelemetry/farplaneFileEvents.js";
import type * as modules_hookTelemetry_httpContracts from "../modules/hookTelemetry/httpContracts.js";
import type * as modules_hookTelemetry_learningTimeline from "../modules/hookTelemetry/learningTimeline.js";
import type * as modules_hookTelemetry_projections from "../modules/hookTelemetry/projections.js";
import type * as modules_hookTelemetry_queries from "../modules/hookTelemetry/queries.js";
import type * as modules_hookTelemetry_validators from "../modules/hookTelemetry/validators.js";
import type * as modules_projectArtefacts_artefacts from "../modules/projectArtefacts/artefacts.js";
import type * as modules_resourceBank_analyses from "../modules/resourceBank/analyses.js";
import type * as modules_resourceBank_assets from "../modules/resourceBank/assets.js";
import type * as modules_resourceBank_brandKitSupport from "../modules/resourceBank/brandKitSupport.js";
import type * as modules_resourceBank_brandKits from "../modules/resourceBank/brandKits.js";
import type * as modules_resourceBank_creativeElements from "../modules/resourceBank/creativeElements.js";
import type * as modules_resourceBank_demo from "../modules/resourceBank/demo.js";
import type * as modules_resourceBank_jobs from "../modules/resourceBank/jobs.js";
import type * as modules_resourceBank_maintenance from "../modules/resourceBank/maintenance.js";
import type * as modules_resourceBank_records from "../modules/resourceBank/records.js";
import type * as modules_resourceBank_resourceBank from "../modules/resourceBank/resourceBank.js";
import type * as modules_resourceBank_retrieval from "../modules/resourceBank/retrieval.js";
import type * as modules_resourceBank_skillFindings from "../modules/resourceBank/skillFindings.js";
import type * as modules_resourceBank_validators from "../modules/resourceBank/validators.js";
import type * as modules_runtimeTelemetry_runtimeTelemetry from "../modules/runtimeTelemetry/runtimeTelemetry.js";
import type * as modules_runtimeTelemetry_telemetry from "../modules/runtimeTelemetry/telemetry.js";
import type * as modules_runtimeTelemetry_validators from "../modules/runtimeTelemetry/validators.js";
import type * as modules_skillInvocations_contracts from "../modules/skillInvocations/contracts.js";
import type * as modules_skillInvocations_queries from "../modules/skillInvocations/queries.js";
import type * as modules_skillInvocations_validators from "../modules/skillInvocations/validators.js";
import type * as modules_videoIntelligence_comparisonRules from "../modules/videoIntelligence/comparisonRules.js";
import type * as modules_videoIntelligence_comparisons from "../modules/videoIntelligence/comparisons.js";
import type * as modules_videoIntelligence_domain from "../modules/videoIntelligence/domain.js";
import type * as modules_videoIntelligence_editorial from "../modules/videoIntelligence/editorial.js";
import type * as modules_videoIntelligence_editorialCuration from "../modules/videoIntelligence/editorialCuration.js";
import type * as modules_videoIntelligence_editorialMigrations from "../modules/videoIntelligence/editorialMigrations.js";
import type * as modules_videoIntelligence_editorialProjection from "../modules/videoIntelligence/editorialProjection.js";
import type * as modules_videoIntelligence_progressModel from "../modules/videoIntelligence/progressModel.js";
import type * as modules_videoIntelligence_projection from "../modules/videoIntelligence/projection.js";
import type * as modules_videoIntelligence_queueModel from "../modules/videoIntelligence/queueModel.js";
import type * as modules_videoIntelligence_replay from "../modules/videoIntelligence/replay.js";
import type * as modules_videoIntelligence_replayModel from "../modules/videoIntelligence/replayModel.js";
import type * as modules_videoIntelligence_timelineMigrations from "../modules/videoIntelligence/timelineMigrations.js";
import type * as modules_videoIntelligence_timelineProjection from "../modules/videoIntelligence/timelineProjection.js";
import type * as modules_videoIntelligence_validators from "../modules/videoIntelligence/validators.js";
import type * as modules_videoIntelligence_videos from "../modules/videoIntelligence/videos.js";
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
  crons: typeof crons;
  events: typeof events;
  http: typeof http;
  "modules/agentActivity/contracts": typeof modules_agentActivity_contracts;
  "modules/agentActivity/events": typeof modules_agentActivity_events;
  "modules/agentActivity/httpContracts": typeof modules_agentActivity_httpContracts;
  "modules/agentActivity/status": typeof modules_agentActivity_status;
  "modules/content/discoveries": typeof modules_content_discoveries;
  "modules/content/identifiers": typeof modules_content_identifiers;
  "modules/content/intelligenceProjection": typeof modules_content_intelligenceProjection;
  "modules/content/intelligenceProjectionModel": typeof modules_content_intelligenceProjectionModel;
  "modules/content/migrations": typeof modules_content_migrations;
  "modules/content/records": typeof modules_content_records;
  "modules/content/saves": typeof modules_content_saves;
  "modules/content/timeline": typeof modules_content_timeline;
  "modules/content/timelineMigrations": typeof modules_content_timelineMigrations;
  "modules/content/timelineProjection": typeof modules_content_timelineProjection;
  "modules/hookTelemetry/events": typeof modules_hookTelemetry_events;
  "modules/hookTelemetry/farplaneFileEvents": typeof modules_hookTelemetry_farplaneFileEvents;
  "modules/hookTelemetry/httpContracts": typeof modules_hookTelemetry_httpContracts;
  "modules/hookTelemetry/learningTimeline": typeof modules_hookTelemetry_learningTimeline;
  "modules/hookTelemetry/projections": typeof modules_hookTelemetry_projections;
  "modules/hookTelemetry/queries": typeof modules_hookTelemetry_queries;
  "modules/hookTelemetry/validators": typeof modules_hookTelemetry_validators;
  "modules/projectArtefacts/artefacts": typeof modules_projectArtefacts_artefacts;
  "modules/resourceBank/analyses": typeof modules_resourceBank_analyses;
  "modules/resourceBank/assets": typeof modules_resourceBank_assets;
  "modules/resourceBank/brandKitSupport": typeof modules_resourceBank_brandKitSupport;
  "modules/resourceBank/brandKits": typeof modules_resourceBank_brandKits;
  "modules/resourceBank/creativeElements": typeof modules_resourceBank_creativeElements;
  "modules/resourceBank/demo": typeof modules_resourceBank_demo;
  "modules/resourceBank/jobs": typeof modules_resourceBank_jobs;
  "modules/resourceBank/maintenance": typeof modules_resourceBank_maintenance;
  "modules/resourceBank/records": typeof modules_resourceBank_records;
  "modules/resourceBank/resourceBank": typeof modules_resourceBank_resourceBank;
  "modules/resourceBank/retrieval": typeof modules_resourceBank_retrieval;
  "modules/resourceBank/skillFindings": typeof modules_resourceBank_skillFindings;
  "modules/resourceBank/validators": typeof modules_resourceBank_validators;
  "modules/runtimeTelemetry/runtimeTelemetry": typeof modules_runtimeTelemetry_runtimeTelemetry;
  "modules/runtimeTelemetry/telemetry": typeof modules_runtimeTelemetry_telemetry;
  "modules/runtimeTelemetry/validators": typeof modules_runtimeTelemetry_validators;
  "modules/skillInvocations/contracts": typeof modules_skillInvocations_contracts;
  "modules/skillInvocations/queries": typeof modules_skillInvocations_queries;
  "modules/skillInvocations/validators": typeof modules_skillInvocations_validators;
  "modules/videoIntelligence/comparisonRules": typeof modules_videoIntelligence_comparisonRules;
  "modules/videoIntelligence/comparisons": typeof modules_videoIntelligence_comparisons;
  "modules/videoIntelligence/domain": typeof modules_videoIntelligence_domain;
  "modules/videoIntelligence/editorial": typeof modules_videoIntelligence_editorial;
  "modules/videoIntelligence/editorialCuration": typeof modules_videoIntelligence_editorialCuration;
  "modules/videoIntelligence/editorialMigrations": typeof modules_videoIntelligence_editorialMigrations;
  "modules/videoIntelligence/editorialProjection": typeof modules_videoIntelligence_editorialProjection;
  "modules/videoIntelligence/progressModel": typeof modules_videoIntelligence_progressModel;
  "modules/videoIntelligence/projection": typeof modules_videoIntelligence_projection;
  "modules/videoIntelligence/queueModel": typeof modules_videoIntelligence_queueModel;
  "modules/videoIntelligence/replay": typeof modules_videoIntelligence_replay;
  "modules/videoIntelligence/replayModel": typeof modules_videoIntelligence_replayModel;
  "modules/videoIntelligence/timelineMigrations": typeof modules_videoIntelligence_timelineMigrations;
  "modules/videoIntelligence/timelineProjection": typeof modules_videoIntelligence_timelineProjection;
  "modules/videoIntelligence/validators": typeof modules_videoIntelligence_validators;
  "modules/videoIntelligence/videos": typeof modules_videoIntelligence_videos;
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
