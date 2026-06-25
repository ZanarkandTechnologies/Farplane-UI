"use client";

import { useEffect, useState } from "react";
import {
  isHarnessGraphPayload,
  isHarnessAdoptionPayload,
  isHarnessBridgePayload,
  isHarnessLifecyclePayload,
  isHarnessSkillRolloutPayload,
  isHarnessTemplateTrackingPayload,
  isHarnessTemplateIntelligencePayload,
} from "./harness-os-model";
import type {
  HarnessAdoptionPayload,
  HarnessGraphPayload,
  HarnessLifecyclePayload,
  HarnessSkillRolloutPayload,
  HarnessTemplateTrackingPayload,
  HarnessTemplateIntelligencePayload,
} from "./harness-os-types";

export function useHarnessOsData(): {
  adoption: HarnessAdoptionPayload | null;
  adoptionError: string | null;
  error: string | null;
  graph: HarnessGraphPayload | null;
  lifecycle: HarnessLifecyclePayload | null;
  skillRollout: HarnessSkillRolloutPayload | null;
  skillRolloutError: string | null;
  templateTracking: HarnessTemplateTrackingPayload | null;
  templateTrackingError: string | null;
  templateIntelligence: HarnessTemplateIntelligencePayload | null;
} {
  const [adoption, setAdoption] = useState<HarnessAdoptionPayload | null>(null);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);
  const [graph, setGraph] = useState<HarnessGraphPayload | null>(null);
  const [lifecycle, setLifecycle] = useState<HarnessLifecyclePayload | null>(null);
  const [skillRollout, setSkillRollout] = useState<HarnessSkillRolloutPayload | null>(null);
  const [skillRolloutError, setSkillRolloutError] = useState<string | null>(null);
  const [templateTracking, setTemplateTracking] = useState<HarnessTemplateTrackingPayload | null>(null);
  const [templateTrackingError, setTemplateTrackingError] = useState<string | null>(null);
  const [templateIntelligence, setTemplateIntelligence] =
    useState<HarnessTemplateIntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [
          graphResponse,
          lifecycleResponse,
          templateResponse,
          adoptionResponse,
          skillRolloutResponse,
          templateTrackingResponse,
        ] = await Promise.all([
          fetch("/codex/skill-maintenance-graph/farplane-framework-core-graph.json"),
          fetch("/codex/skill-maintenance-graph/farplane-lifecycle-graph.json"),
          fetch("/codex/skill-maintenance-graph/skill-template-intelligence.json"),
          fetch("/farplane/harness/adoption-scan"),
          fetch("/farplane/harness/skills-rollout-scan"),
          fetch("/farplane/harness/template-tracking-scan"),
        ]);
        let nextGraphError: string | null = null;
        const graphPayload = graphResponse.ok ? (await graphResponse.json()) as unknown : null;
        if (cancelled) return;
        if (isHarnessGraphPayload(graphPayload)) {
          setGraph(graphPayload);
        } else {
          setGraph(null);
          nextGraphError = graphResponse.ok
            ? "harness_graph_payload_invalid"
            : "harness_graph_unavailable";
        }
        if (lifecycleResponse.ok) {
          const lifecyclePayload = (await lifecycleResponse.json()) as unknown;
          setLifecycle(isHarnessLifecyclePayload(lifecyclePayload) ? lifecyclePayload : null);
        } else {
          setLifecycle(null);
        }
        if (templateResponse.ok) {
          const templatePayload = (await templateResponse.json()) as unknown;
          setTemplateIntelligence(
            isHarnessTemplateIntelligencePayload(templatePayload) ? templatePayload : null,
          );
        } else {
          setTemplateIntelligence(null);
        }
        if (adoptionResponse.ok) {
          const bridgePayload = (await adoptionResponse.json()) as unknown;
          if (isHarnessBridgePayload(bridgePayload, isHarnessAdoptionPayload)) {
            setAdoption(bridgePayload.payload ?? null);
            setAdoptionError(bridgePayload.ok ? null : bridgePayload.error ?? "adoption_scan_failed");
          } else {
            setAdoption(null);
            setAdoptionError("adoption_scan_payload_invalid");
          }
        } else {
          const bridgePayload = (await adoptionResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          setAdoption(null);
          setAdoptionError(bridgePayload.error ?? "adoption_scan_unavailable");
        }
        if (skillRolloutResponse.ok) {
          const bridgePayload = (await skillRolloutResponse.json()) as unknown;
          if (isHarnessBridgePayload(bridgePayload, isHarnessSkillRolloutPayload)) {
            setSkillRollout(bridgePayload.payload ?? null);
            setSkillRolloutError(
              bridgePayload.ok ? null : bridgePayload.error ?? "skills_rollout_scan_failed",
            );
          } else {
            setSkillRollout(null);
            setSkillRolloutError("skills_rollout_payload_invalid");
          }
        } else {
          const bridgePayload = (await skillRolloutResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          setSkillRollout(null);
          setSkillRolloutError(bridgePayload.error ?? "skills_rollout_scan_unavailable");
        }
        if (templateTrackingResponse.ok) {
          const bridgePayload = (await templateTrackingResponse.json()) as unknown;
          if (isHarnessBridgePayload(bridgePayload, isHarnessTemplateTrackingPayload)) {
            setTemplateTracking(bridgePayload.payload ?? null);
            setTemplateTrackingError(
              bridgePayload.ok ? null : bridgePayload.error ?? "template_tracking_scan_failed",
            );
          } else {
            setTemplateTracking(null);
            setTemplateTrackingError("template_tracking_payload_invalid");
          }
        } else {
          const bridgePayload = (await templateTrackingResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          setTemplateTracking(null);
          setTemplateTrackingError(bridgePayload.error ?? "template_tracking_scan_unavailable");
        }
        setError(nextGraphError);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "harness_os_load_failed");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    adoption,
    adoptionError,
    error,
    graph,
    lifecycle,
    skillRollout,
    skillRolloutError,
    templateTracking,
    templateTrackingError,
    templateIntelligence,
  };
}
