import type React from "react";

import { SoundtrackPlayer } from "@/modules/soundtrack";

import { moduleRegistry } from "./module-registry";
import { Office3dRenderer } from "./renderers/office3d";
import { StandardRenderer } from "./renderers/standard";
import {
  DEFAULT_FARPLANE_UI_CONFIG,
  type FarplaneShellConfig,
  normalizeFarplaneUiConfig,
} from "./shell-config";

export type FarplaneShellProps = {
  config?: Partial<FarplaneShellConfig>;
};

export function FarplaneShell({
  config = DEFAULT_FARPLANE_UI_CONFIG,
}: FarplaneShellProps): React.JSX.Element {
  const normalizedConfig = normalizeFarplaneUiConfig(config);
  const rendererProps = {
    config: normalizedConfig,
    moduleRegistry,
  };

  const renderer =
    normalizedConfig.renderer === "standard" ? (
      <StandardRenderer {...rendererProps} />
    ) : (
      <Office3dRenderer {...rendererProps} />
    );

  return (
    <>
      {renderer}
      {normalizedConfig.modules.includes("soundtrack") ? <SoundtrackPlayer /> : null}
    </>
  );
}
