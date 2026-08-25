/**
 * Shared local YouTube runtime contract.
 *
 * Inputs: fixed loopback endpoints used by the installed extension and bridge.
 * Outputs: browser-safe URLs, request-header names, and operator command text.
 * Side effects: none. Keep this module free of Node-only imports so extension
 * callers and the Node bridge use one endpoint contract without port drift.
 */

export const YOUTUBE_LOCAL_HOST = "127.0.0.1";
export const YOUTUBE_BRIDGE_PORT = 47_893;
export const YOUTUBE_APP_SERVER_PORT = 47_892;
export const YOUTUBE_BRIDGE_URL = `http://${YOUTUBE_LOCAL_HOST}:${YOUTUBE_BRIDGE_PORT}`;
export const YOUTUBE_APP_SERVER_URL = `ws://${YOUTUBE_LOCAL_HOST}:${YOUTUBE_APP_SERVER_PORT}`;
export const YOUTUBE_HEALTH_PATH = "/health";

export const YOUTUBE_RUNTIME_CLIENT_HEADER = "x-farplane-client";
export const YOUTUBE_RUNTIME_CLIENT = "youtube-shortcut";
export const YOUTUBE_RUNTIME_TOKEN_HEADER = "x-farplane-runtime-token";
export const YOUTUBE_RUNTIME_NAME = "farplane-youtube-shortcut";

export const YOUTUBE_RUNTIME_DIRECTORY = "youtube-shortcut";
export const YOUTUBE_RUNTIME_RECORD_FILENAME = "runtime.json";
export const YOUTUBE_START_COMMAND = "farplane extension youtube start";
