/**
 * Owns office Canvas crash containment and targeted browser diagnostics.
 * Inputs are scene children; output is either the scene or a reload affordance.
 * Side effects are limited to one console error and a dev-only QA probe per failure.
 */

"use client";

import { RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface OfficeSceneErrorBoundaryProps {
  children: ReactNode;
}

interface OfficeSceneErrorBoundaryState {
  error: Error | null;
}

interface OfficeSceneFailureDiagnostic {
  message: string;
  componentStack: string | null;
  capturedAt: string;
}

function buildOfficeSceneFailureDiagnostic(
  error: Error,
  errorInfo: ErrorInfo,
): OfficeSceneFailureDiagnostic {
  return {
    message: error.message,
    componentStack: errorInfo.componentStack ?? null,
    capturedAt: new Date().toISOString(),
  };
}

export class OfficeSceneErrorBoundary extends Component<
  OfficeSceneErrorBoundaryProps,
  OfficeSceneErrorBoundaryState
> {
  state: OfficeSceneErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): OfficeSceneErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const diagnostic = buildOfficeSceneFailureDiagnostic(error, errorInfo);
    console.error("[office-scene] Canvas crashed", diagnostic);

    if (import.meta.env.DEV && typeof window !== "undefined") {
      Object.assign(window, { __FARPLANE_OFFICE_SCENE_ERROR__: diagnostic });
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="flex h-full min-h-64 w-full items-center justify-center bg-background px-6 text-foreground"
        data-office-scene-error
        role="alert"
      >
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold">Office scene stopped</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The 3D renderer lost its runtime context. Reload the scene to reconnect it.
          </p>
          <Button className="mt-4" onClick={() => window.location.reload()} type="button">
            <RefreshCw aria-hidden="true" />
            Reload scene
          </Button>
        </div>
      </div>
    );
  }
}
