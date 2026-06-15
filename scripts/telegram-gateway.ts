/**
 * Public entrypoint for the local Telegram gateway.
 *
 * Inputs: CLI invocation or module imports from tests/scripts.
 * Outputs: re-exported gateway helpers plus the long-running CLI loop.
 * Side effects: only when invoked directly as a CLI.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTelegramGatewayCli } from "./telegram-gateway/cli";

export { requestCodexAppServerRpc, sendCodexMessage } from "./telegram-gateway/codex-app-server";
export { defaultConfigPath, loadGatewayFileConfig, resolveGatewayConfig } from "./telegram-gateway/config";
export { processPendingMessages, processTelegramUpdate } from "./telegram-gateway/processor";
export {
  buildCoordinatorPrompt,
  buildSourceThreadPrompt,
  isRetryableCodexDeliveryError,
  resolveTelegramRoute,
} from "./telegram-gateway/routing";
export {
  appendHistory,
  defaultStatePath,
  emptyGatewayState,
  loadGatewayState,
  mergeGatewayState,
  queuePendingMessage,
  recordOutboundMapping,
  removePendingMessage,
  saveGatewayState,
  updatePendingMessage,
} from "./telegram-gateway/state";
export {
  fetchTelegramUpdates,
  sendTelegramNotification,
  sendTelegramReply,
  telegramApi,
} from "./telegram-gateway/telegram-api";
export type {
  CodexTurn,
  CodexTurnItem,
  JsonRpcMessage,
  ResolvedTelegramGatewayConfig,
  TelegramApiResponse,
  TelegramGatewayConfig,
  TelegramGatewayFileConfig,
  TelegramGatewayHistoryEntry,
  TelegramGatewayMapping,
  TelegramGatewayPendingMessage,
  TelegramGatewayState,
  TelegramRouteDecision,
  TelegramSendMessageResult,
  TelegramUpdate,
} from "./telegram-gateway/types";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runTelegramGatewayCli();
}
