"use client";

import { useEffect, useState } from "react";
import type { SkillStudioDetail } from "@/modules/runtime";

export type LoadedSkillDetail = { skillId: string; detail: SkillStudioDetail } | null;

export function detailForSelectedSkill(
  loaded: LoadedSkillDetail,
  selectedSkillId: string,
): SkillStudioDetail | null {
  return loaded?.skillId === selectedSkillId ? loaded.detail : null;
}

export function useSkillStudioDetail(skillId: string): SkillStudioDetail | null {
  const [loaded, setLoaded] = useState<LoadedSkillDetail>(null);
  useEffect(() => {
    let cancelled = false;
    if (!skillId) {
      setLoaded(null);
      return () => {
        cancelled = true;
      };
    }
    fetch(`/openclaw/skills/${encodeURIComponent(skillId)}`)
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("skill_detail_unavailable")),
      )
      .then((payload: { skill?: SkillStudioDetail }) => {
        if (!cancelled && payload.skill) setLoaded({ skillId, detail: payload.skill });
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [skillId]);
  return detailForSelectedSkill(loaded, skillId);
}
