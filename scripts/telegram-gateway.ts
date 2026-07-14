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

export {
  sendCodexMessage,
  startCodexThread,
  telegramGatewayCodexExecTestInternals,
} from "./telegram-gateway/codex-exec";
export { defaultConfigPath, loadGatewayFileConfig, resolveGatewayConfig } from "./telegram-gateway/config";
export { processPendingMessages, processTelegramUpdate } from "./telegram-gateway/processor";
export {
  createReviewRelayBinding,
  startReviewRelayServer,
  submitReviewRelayResponse,
} from "./telegram-gateway/review-relay";
export {
  buildCoordinatorPrompt,
  buildSourceThreadPrompt,
  isRetryableCodexDeliveryError,
  isTerminalCodexDeliveryError,
  resolveTelegramRoute,
} from "./telegram-gateway/routing";
export {
  appendHistory,
  defaultStatePath,
  emptyGatewayState,
  loadGatewayState,
  mergeGatewayState,
  queuePendingMessage,
  recordReviewRelayBinding,
  recordReviewRelayReceipt,
  recordOutboundMapping,
  removePendingMessage,
  saveGatewayState,
  updatePendingMessage,
} from "./telegram-gateway/state";
export {
  fetchTelegramUpdates,
  formatTelegramGatewayMessage,
  sendTelegramDocument,
  sendTelegramNotification,
  sendTelegramReply,
  telegramApi,
  validateTelegramArtifactPath,
} from "./telegram-gateway/telegram-api";
export type {
  CodexTurnItem,
  ReviewRelayBinding,
  ReviewRelayDecision,
  ReviewRelayReceipt,
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
