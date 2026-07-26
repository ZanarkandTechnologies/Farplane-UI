import type React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { EvalOsPanel } from "@/modules/evals";
import {
  HarnessGraphPanel,
  HarnessOsPanel,
  HarnessRolloutSurface,
  RolloutSurface,
  TemplateRolloutSurface,
  TemplateTrackingSurface,
} from "@/modules/harness-os";
import { RawTelemetryRoute } from "@/modules/hook-telemetry";
import { SkillOsMiniApp } from "@/modules/skills-studio/components/skill-os";
import { ThreadDataPanel } from "@/modules/thread-data";
import { LandingPage } from "@/pages/LandingPage";
import { OfficePage } from "@/pages/OfficePage";

export function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/harness-os"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <HarnessOsPanel />
          </main>
        }
      />
      <Route
        path="/harness-graph"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <HarnessGraphPanel />
          </main>
        }
      />
      <Route
        path="/harness-rollout"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <HarnessRolloutSurface />
          </main>
        }
      />
      <Route
        path="/skill-rollout"
        element={
          <main className="box-border h-[100dvh] w-[100dvw] overflow-hidden bg-background p-4 text-foreground">
            <SkillOsMiniApp initialFilter="needs-care" />
          </main>
        }
      />
      <Route
        path="/rollout"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <RolloutSurface />
          </main>
        }
      />
      <Route
        path="/template-rollout"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <TemplateRolloutSurface />
          </main>
        }
      />
      <Route
        path="/template-tracking"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <TemplateTrackingSurface />
          </main>
        }
      />
      <Route
        path="/skills"
        element={
          <main className="box-border h-[100dvh] w-[100dvw] overflow-hidden bg-background p-4 text-foreground">
            <SkillOsMiniApp />
          </main>
        }
      />
      <Route
        path="/evals"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <EvalOsPanel />
          </main>
        }
      />
      <Route path="/hook-telemetry" element={<RawTelemetryRoute />} />
      <Route
        path="/thread-data"
        element={
          <main className="h-[100dvh] w-[100dvw] overflow-auto bg-background p-4 text-foreground">
            <ThreadDataPanel />
          </main>
        }
      />
      <Route path="/office" element={<OfficePage />} />
      <Route path="/office/public" element={<OfficePage accessMode="public" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
