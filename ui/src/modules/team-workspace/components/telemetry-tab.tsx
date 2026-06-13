"use client";

import type { ReactElement } from "react";
import { TelemetryDashboardContent } from "@/modules/telemetry";

type TelemetryTabProps = {
  projectId: string | null;
  teamId: string | null;
  title: string;
};

export function TelemetryTab({ projectId, teamId, title }: TelemetryTabProps): ReactElement {
  return (
    <TelemetryDashboardContent
      mode="team"
      projectId={projectId}
      teamId={teamId}
      title={title}
    />
  );
}
