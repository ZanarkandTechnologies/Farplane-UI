"use client";

/**
 * TanStack Query provider for Farplane UI HTTP bridge state.
 * Owns cache policy for Vite/app-server fetches; Convex realtime data stays on
 * Convex hooks and should not be routed through this provider.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function FarplaneQueryProvider({ children }: { children: ReactNode }): ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
