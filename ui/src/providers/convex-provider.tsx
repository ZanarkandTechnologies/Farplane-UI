import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() || "";
const disabledConvexUrl = "http://127.0.0.1:3210";
const convexClient = new ConvexReactClient(convexUrl || disabledConvexUrl);

export function isConvexEnabled(): boolean {
  return Boolean(convexUrl);
}

export function FarplaneConvexProvider({ children }: { children: ReactNode }): JSX.Element {
  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
