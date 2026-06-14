"use client";

/**
 * OFFICE ACCESS MODE PROVIDER
 * ===========================
 * App-level read/write policy for operator, viewer, and public office surfaces.
 *
 * KEY CONCEPTS:
 * - Shell/routes choose the access mode; leaves consume typed policy.
 * - Read-only modes must block writes at runtime boundaries, not only hide UI.
 * - Public mode is read-only plus stream-safe chrome/redaction affordances.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

export type OfficeAccessMode = "operator" | "viewer" | "public";

export type OfficeAccessModeContextValue = {
  accessMode: OfficeAccessMode;
  isOperator: boolean;
  isPublic: boolean;
  isReadOnly: boolean;
};

const OfficeAccessModeContext = createContext<OfficeAccessModeContextValue | null>(null);

export function isOfficeAccessMode(value: string): value is OfficeAccessMode {
  return value === "operator" || value === "viewer" || value === "public";
}

export function normalizeOfficeAccessMode(value: unknown): OfficeAccessMode {
  return typeof value === "string" && isOfficeAccessMode(value) ? value : "operator";
}

export function isReadOnlyOfficeAccessMode(value: OfficeAccessMode): boolean {
  return value === "viewer" || value === "public";
}

export function OfficeAccessModeProvider({
  accessMode,
  children,
}: {
  accessMode?: OfficeAccessMode;
  children: ReactNode;
}): React.JSX.Element {
  const normalizedAccessMode = normalizeOfficeAccessMode(accessMode);
  const value = useMemo<OfficeAccessModeContextValue>(
    () => ({
      accessMode: normalizedAccessMode,
      isOperator: normalizedAccessMode === "operator",
      isPublic: normalizedAccessMode === "public",
      isReadOnly: isReadOnlyOfficeAccessMode(normalizedAccessMode),
    }),
    [normalizedAccessMode],
  );

  return (
    <OfficeAccessModeContext.Provider value={value}>
      {children}
    </OfficeAccessModeContext.Provider>
  );
}

export function useOfficeAccessMode(): OfficeAccessModeContextValue {
  return (
    useContext(OfficeAccessModeContext) ?? {
      accessMode: "operator",
      isOperator: true,
      isPublic: false,
      isReadOnly: false,
    }
  );
}
