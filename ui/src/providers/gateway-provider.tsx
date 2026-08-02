/**
 * GATEWAY PROVIDER
 * ================
 * Own the live WebSocket client for gateway-backed UI features.
 *
 * KEY CONCEPTS:
 * - Non-secret gateway config is local-ui state and can change at runtime.
 * - Gateway credentials come only from the injected Vite environment.
 * - Saving config should reconnect in place instead of forcing a page reload.
 *
 * USAGE:
 * - Read `client` and `connected` via `useGateway()`.
 * - Call `updateConfig()` after settings changes to rebuild the client.
 *
 * MEMORY REFERENCES:
 * - MEM-0175
 */
"use client";

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type GatewayUiConfig,
  getGatewayUiConfig,
  saveGatewayUiConfig,
} from "@/modules/runtime";
import { GatewayWsClient } from "@/modules/runtime";
import { getRuntimeAdapterKind } from "@/modules/runtime";

type GatewayContextValue = {
  client: GatewayWsClient;
  connected: boolean;
  config: GatewayUiConfig;
  updateConfig: (next: Partial<GatewayUiConfig>) => GatewayUiConfig;
};

const GatewayContext = createContext<GatewayContextValue | null>(null);

function toGatewayWsUrl(baseUrl: string): string {
  if (baseUrl.startsWith("ws://") || baseUrl.startsWith("wss://")) return baseUrl;
  if (baseUrl.startsWith("https://")) return `wss://${baseUrl.slice("https://".length)}`;
  if (baseUrl.startsWith("http://")) return `ws://${baseUrl.slice("http://".length)}`;
  return `ws://${baseUrl}`;
}

function shouldLogGatewayLifecycle(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return window.localStorage.getItem("farplane.debug.gateway") === "1";
}

function logGatewayLifecycle(event: string, details: Record<string, unknown> = {}): void {
  if (!shouldLogGatewayLifecycle()) return;
  console.debug("[farplane:gateway]", event, details);
}

export function GatewayProvider({ children }: { children: ReactNode }): ReactElement {
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<GatewayUiConfig>(() => getGatewayUiConfig());
  const shouldConnectGateway =
    getRuntimeAdapterKind(import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER) === "openclaw";
  const client = useMemo(
    () =>
      new GatewayWsClient({
        url: toGatewayWsUrl(config.gatewayBase),
        token: config.gatewayToken,
        onConnectionStateChange: (nextConnected) => {
          logGatewayLifecycle("connection-state", { connected: nextConnected });
          setConnected(nextConnected);
        },
      }),
    [config.gatewayBase, config.gatewayToken],
  );

  useEffect(() => {
    if (!shouldConnectGateway) {
      logGatewayLifecycle("disabled", {
        runtimeAdapter: import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER ?? "codex",
      });
      setConnected(false);
      return;
    }
    logGatewayLifecycle("start", { url: toGatewayWsUrl(config.gatewayBase) });
    client.start();
    return () => {
      logGatewayLifecycle("stop", { url: toGatewayWsUrl(config.gatewayBase) });
      client.stop();
    };
  }, [client, config.gatewayBase, shouldConnectGateway]);

  const value = useMemo(
    () => ({
      client,
      connected,
      config,
      updateConfig: (next: Partial<GatewayUiConfig>) => {
        const saved = saveGatewayUiConfig(next);
        logGatewayLifecycle("config-updated", {
          gatewayBaseChanged: saved.gatewayBase !== config.gatewayBase,
          stateBaseChanged: saved.stateBase !== config.stateBase,
        });
        setConfig(saved);
        return saved;
      },
    }),
    [client, config, connected],
  );
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway(): GatewayContextValue {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error("useGateway must be used within GatewayProvider");
  }
  return context;
}
