"use client";

/**
 * OPEN PANEL FROM URL
 * ===================
 * `/office?panel=<id>` opens that office panel on load, so other surfaces (the Farplane bunker's
 * Master Control dashboards) can link straight to a panel. Unknown ids are ignored.
 *
 * KEY CONCEPTS:
 * - Opens through the same launcher as the HUD (useOfficeInternalPanelLauncher), once per load.
 */

import { useEffect, useRef } from "react";

import { isOfficeInternalPanelId } from "./internal-panel-catalog";
import { useOfficeInternalPanelLauncher } from "./use-internal-panel-launcher";

export function OpenPanelFromUrl(): null {
  const launch = useOfficeInternalPanelLauncher();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const id = new URLSearchParams(window.location.search).get("panel");
    if (isOfficeInternalPanelId(id)) launch(id);
  }, [launch]);
  return null;
}
