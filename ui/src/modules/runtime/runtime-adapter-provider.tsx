"use client";

import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from "react";
import {
  createOfficeRuntimeAdapter,
  getRuntimeAdapterKind,
  type OfficeRuntimeAdapter,
} from "./lib/adapters";
import { useGateway } from "@/providers/gateway-provider";

type RuntimeAdapterContextValue = {
  adapter: OfficeRuntimeAdapter;
};

const RuntimeAdapterContext = createContext<RuntimeAdapterContextValue | null>(null);

export function RuntimeAdapterProvider({ children }: { children: ReactNode }): ReactElement {
  const { client: wsClient, config } = useGateway();
  const runtimeKind = getRuntimeAdapterKind(import.meta.env.VITE_FARPLANE_RUNTIME_ADAPTER);
  const value = useMemo(
    () => ({
      adapter: createOfficeRuntimeAdapter({
        kind: runtimeKind,
        stateUrl: config.stateBase,
        wsClient,
      }),
    }),
    [config.stateBase, runtimeKind, wsClient],
  );
  return <RuntimeAdapterContext.Provider value={value}>{children}</RuntimeAdapterContext.Provider>;
}

export function useOfficeRuntimeAdapter(): OfficeRuntimeAdapter {
  const context = useContext(RuntimeAdapterContext);
  if (!context) {
    throw new Error("useOfficeRuntimeAdapter must be used within RuntimeAdapterProvider");
  }
  return context.adapter;
}
