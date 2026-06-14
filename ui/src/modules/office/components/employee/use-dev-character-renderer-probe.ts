"use client";

/**
 * Dev-only character renderer diagnostics for office employee QA.
 *
 * Ownership: browser-visible proof that an employee resolved to a renderer and whether
 * sprite assets reached a renderable state.
 * Inputs: employee renderer resolution and sprite load status.
 * Outputs: `window.__farplaneOfficeCharacterRenderers` for Playwright/agent-browser probes.
 * Side effects: mutates a dev-only global record in the browser.
 */

import type { CharacterRendererConfig, CharacterRendererId } from "./renderers/types";

type CharacterRendererProbeRow = {
  employeeId: string;
  name: string;
  rendererId: CharacterRendererId;
  source?: CharacterRendererConfig["source"];
  status: "resolved" | "loading" | "ready" | "fallback" | "error";
  message?: string;
  updatedAt: number;
};

declare global {
  interface Window {
    __farplaneOfficeCharacterRenderers?: Record<string, CharacterRendererProbeRow>;
  }
}

function getProbeRows(): Record<string, CharacterRendererProbeRow> | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  window.__farplaneOfficeCharacterRenderers ??= {};
  return window.__farplaneOfficeCharacterRenderers;
}

export function recordDevCharacterRenderer(input: {
  employeeId: string;
  name: string;
  rendererId: CharacterRendererId;
  config: CharacterRendererConfig;
}): void {
  const rows = getProbeRows();
  if (!rows) return;
  rows[input.employeeId] = {
    employeeId: input.employeeId,
    name: input.name,
    rendererId: input.rendererId,
    source: input.config.source,
    status: "resolved",
    updatedAt: Date.now(),
  };
}

export function recordDevCharacterRendererStatus(input: {
  employeeId: string;
  status: CharacterRendererProbeRow["status"];
  message?: string;
}): void {
  const rows = getProbeRows();
  if (!rows) return;
  const existing = rows[input.employeeId];
  if (!existing) return;
  rows[input.employeeId] = {
    ...existing,
    status: input.status,
    message: input.message,
    updatedAt: Date.now(),
  };
}
