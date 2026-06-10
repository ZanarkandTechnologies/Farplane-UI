"use client";

import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from "react";
import {
  createOfficeRuntimeAdapter,
  getRuntimeAdapterKind,
  type OfficeRuntimeAdapter,
} from "@/lib/runtime-adapters";
import { useGateway } from "@/providers/gateway-provider";

type OpenClawAdapterContextValue = {
  adapter: OfficeRuntimeAdapter;
};

const OpenClawAdapterContext = createContext<OpenClawAdapterContextValue | null>(null);

export function OpenClawAdapterProvider({ children }: { children: ReactNode }): ReactElement {
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
  return (
    <OpenClawAdapterContext.Provider value={value}>{children}</OpenClawAdapterContext.Provider>
  );
}

export function useOfficeRuntimeAdapter(): OfficeRuntimeAdapter {
  const context = useContext(OpenClawAdapterContext);
  if (!context) {
    throw new Error("useOfficeRuntimeAdapter must be used within OpenClawAdapterProvider");
  }
  return context.adapter;
}

export function useOpenClawAdapter(): OfficeRuntimeAdapter {
  return useOfficeRuntimeAdapter();
}
