export {
  DEFAULT_USER_COMMUNICATIONS_CONFIG,
  USER_COMMUNICATIONS_CONFIG_STORAGE_KEY,
  buildTelegramGatewayConfigJson,
  buildTelegramGatewayEnv,
  normalizeUserCommunicationsConfig,
  parseUserCommunicationsConfig,
  serializeUserCommunicationsConfig,
  type UserCommunicationsConfig,
} from "./lib/user-communications";

export { UserCommunicationsTab } from "./components/user-communications-tab";
