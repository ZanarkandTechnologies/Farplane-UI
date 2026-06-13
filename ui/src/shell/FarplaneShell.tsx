import type React from "react";

import { moduleRegistry } from "./module-registry";
import {
  DEFAULT_FARPLANE_UI_CONFIG,
  normalizeFarplaneUiConfig,
  type FarplaneShellConfig,
} from "./shell-config";
import { Office3dRenderer } from "./renderers/office3d";
import { StandardRenderer } from "./renderers/standard";

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

  if (normalizedConfig.renderer === "standard") {
    return <StandardRenderer {...rendererProps} />;
  }

  return <Office3dRenderer {...rendererProps} />;
}
