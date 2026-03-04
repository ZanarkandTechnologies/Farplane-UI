import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() || "";
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function isConvexEnabled(): boolean {
  return Boolean(convexClient);
}

export function ShellCorpConvexProvider({ children }: { children: ReactNode }): JSX.Element {
  if (!convexClient) return <>{children}</>;
  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
