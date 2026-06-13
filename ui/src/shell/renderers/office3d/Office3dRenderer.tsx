import type React from "react";

import OfficeSimulation from "@/components/office-simulation";

import type { FarplaneRendererProps } from "../../types";
import type { FarplaneUiModuleId } from "../../module-registry";

export type Office3dRendererProps = FarplaneRendererProps<FarplaneUiModuleId>;

export function Office3dRenderer(_props: Office3dRendererProps): React.JSX.Element {
  return <OfficeSimulation />;
}
