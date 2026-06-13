import type React from "react";

import { App, type AppProps } from "@/App/index";

import type { FarplaneRendererProps } from "../../types";
import type { FarplaneUiModuleId } from "../../module-registry";

export type StandardRendererProps = FarplaneRendererProps<FarplaneUiModuleId> & AppProps;

export function StandardRenderer({ initialTab }: StandardRendererProps): React.JSX.Element {
  return <App initialTab={initialTab} />;
}
