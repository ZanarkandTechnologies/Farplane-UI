"use client";

/**
 * Team-level character policy editor.
 *
 * Inputs: canonical company/project model and runtime adapter persistence.
 * Outputs: persistent/ephemeral defaults plus one skill transformation mapping.
 * Side effects: saves the project character policy to the Farplane company sidecar.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { previewTeamCharacter } from "@/modules/office/components/employee/use-team-character-preview";
import type { OfficeObject } from "@/modules/office/lib/types";
import { upsertTeamSkillTransformation } from "@/modules/office/team-character-policy";
import type {
  CompanyModel,
  OfficeRuntimeAdapter,
  ProjectModel,
  TeamCharacterPolicy,
} from "@/modules/runtime";
import { buildTeamCharacterSkillOptions } from "./team-character-options";

type Props = {
  adapter: OfficeRuntimeAdapter;
  company: CompanyModel;
  project: ProjectModel;
  officeObjects: OfficeObject[];
  teamId: string;
  targetEmployeeId?: string;
  onDemo: () => void;
  onSaved: () => Promise<void> | void;
};

const DEFAULT_POLICY: TeamCharacterPolicy = {
  persistent: { renderer: "three-human" },
  ephemeral: { renderer: "three-human" },
  skillTransformations: {},
};

function petIdFor(policy: TeamCharacterPolicy, presence: "persistent" | "ephemeral"): string {
  return policy[presence].renderer === "sprite-sheet-2d"
    ? (policy[presence].petId ?? "three-human")
    : "three-human";
}

export function TeamCharactersTab({
  adapter,
  company,
  project,
  officeObjects,
  teamId,
  targetEmployeeId,
  onDemo,
  onSaved,
}: Props) {
  const [persistentPetId, setPersistentPetId] = useState("three-human");
  const [ephemeralPetId, setEphemeralPetId] = useState("three-human");
  const [skillId, setSkillId] = useState("research");
  const [demoDestinationSkillId, setDemoDestinationSkillId] = useState("research");
  const [transformationPetId, setTransformationPetId] = useState("mini-chua");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [pets, setPets] = useState<Array<{ id: string; displayName: string }>>([]);
  const landmarkOptions = useMemo(
    () => buildTeamCharacterSkillOptions(officeObjects),
    [officeObjects],
  );
  const skillOptions = useMemo(() => {
    if (landmarkOptions.skills.some((option) => option.value === skillId)) {
      return landmarkOptions.skills;
    }
    return [...landmarkOptions.skills, { value: skillId, label: `${skillId} · saved` }];
  }, [landmarkOptions.skills, skillId]);
  const destinationOptions = useMemo(() => {
    if (landmarkOptions.destinations.some((option) => option.value === demoDestinationSkillId)) {
      return landmarkOptions.destinations;
    }
    return [
      ...landmarkOptions.destinations,
      { value: demoDestinationSkillId, label: `${demoDestinationSkillId} · saved target` },
    ];
  }, [demoDestinationSkillId, landmarkOptions.destinations]);
  const characterOptions = useMemo(() => {
    const byId = new Map<string, string>([["three-human", "3D Human"]]);
    for (const pet of pets) byId.set(pet.id, pet.displayName);
    for (const petId of [persistentPetId, ephemeralPetId, transformationPetId]) {
      if (petId && !byId.has(petId)) byId.set(petId, petId);
    }
    return [...byId].map(([value, label]) => ({ value, label }));
  }, [ephemeralPetId, persistentPetId, pets, transformationPetId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/codex/pets", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { pets: [] };
        return (await response.json()) as {
          pets?: Array<{ id?: string; displayName?: string }>;
        };
      })
      .then((payload) => {
        setPets(
          (payload.pets ?? [])
            .filter((pet): pet is { id: string; displayName?: string } => Boolean(pet.id?.trim()))
            .map((pet) => ({ id: pet.id, displayName: pet.displayName?.trim() || pet.id })),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const policy = project.characterPolicy ?? DEFAULT_POLICY;
    setPersistentPetId(petIdFor(policy, "persistent"));
    setEphemeralPetId(petIdFor(policy, "ephemeral"));
    const firstTransformation = Object.entries(policy.skillTransformations)[0];
    if (firstTransformation) {
      setSkillId(firstTransformation[0]);
      setDemoDestinationSkillId(firstTransformation[0]);
      setTransformationPetId(
        firstTransformation[1].character.renderer === "sprite-sheet-2d"
          ? (firstTransformation[1].character.petId ?? "three-human")
          : "three-human",
      );
    } else {
      const defaultSkillId =
        landmarkOptions.skills.find((option) => option.value === "research")?.value ??
        landmarkOptions.skills[0]?.value ??
        "research";
      const defaultDestinationSkillId =
        landmarkOptions.destinations.find((option) => option.value === defaultSkillId)?.value ??
        landmarkOptions.destinations[0]?.value ??
        defaultSkillId;
      setSkillId(defaultSkillId);
      setDemoDestinationSkillId(defaultDestinationSkillId);
      setTransformationPetId("mini-chua");
    }
  }, [landmarkOptions.destinations, landmarkOptions.skills, project]);

  async function savePolicy(): Promise<void> {
    const normalizedSkillId = skillId.trim();
    const normalizedTransformationPetId = transformationPetId.trim();
    if (!normalizedSkillId || !normalizedTransformationPetId) {
      setStatus("Add a skill and transformation character.");
      return;
    }
    const basePolicy: TeamCharacterPolicy = {
      persistent:
        persistentPetId !== "three-human"
          ? { renderer: "sprite-sheet-2d", petId: persistentPetId.trim() }
          : { renderer: "three-human" },
      ephemeral:
        ephemeralPetId !== "three-human"
          ? { renderer: "sprite-sheet-2d", petId: ephemeralPetId.trim() }
          : { renderer: "three-human" },
      skillTransformations: project.characterPolicy?.skillTransformations ?? {},
    };
    const characterPolicy = upsertTeamSkillTransformation({
      policy: basePolicy,
      skillId: normalizedSkillId,
      character:
        normalizedTransformationPetId === "three-human"
          ? { renderer: "three-human" }
          : { renderer: "sprite-sheet-2d", petId: normalizedTransformationPetId },
    });
    setSaving(true);
    setStatus("");
    const result = await adapter.saveCompanyModel({
      ...company,
      projects: company.projects.map((row) =>
        row.id === project.id ? { ...row, characterPolicy } : row,
      ),
    });
    if (!result.ok) {
      setStatus(result.error ?? "Could not save character policy.");
      setSaving(false);
      return;
    }
    await onSaved();
    setStatus("Characters saved.");
    setSaving(false);
  }

  function demoTransformation(): void {
    const normalizedSkillId = skillId.trim();
    const normalizedDestinationSkillId = demoDestinationSkillId.trim();
    const normalizedPetId = transformationPetId.trim();
    if (
      !normalizedSkillId ||
      !normalizedDestinationSkillId ||
      !normalizedPetId ||
      !targetEmployeeId
    ) {
      setStatus("Choose a skill, destination, and character for a team lead.");
      return;
    }
    previewTeamCharacter({
      eventId: `team-skill-demo:${project.id}:${normalizedSkillId}:${Date.now()}`,
      startedAt: Date.now(),
      teamId,
      targetEmployeeId,
      skillId: normalizedSkillId,
      destinationSkillId: normalizedDestinationSkillId,
      character:
        normalizedPetId === "three-human"
          ? { renderer: "three-human" }
          : { renderer: "sprite-sheet-2d", petId: normalizedPetId },
      persistUntilReplaced: true,
    });
    onDemo();
  }

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-auto pr-2 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Team characters</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          One default for the team lead and one for temporary workers.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="persistent-pet">Persistent character</Label>
            <Select value={persistentPetId} onValueChange={setPersistentPetId}>
              <SelectTrigger id="persistent-pet" className="w-full">
                <SelectValue placeholder="Choose a character" />
              </SelectTrigger>
              <SelectContent>
                {characterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ephemeral-pet">Ephemeral character</Label>
            <Select value={ephemeralPetId} onValueChange={setEphemeralPetId}>
              <SelectTrigger id="ephemeral-pet" className="w-full">
                <SelectValue placeholder="Choose a character" />
              </SelectTrigger>
              <SelectContent>
                {characterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Skill transformation</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Poof into a temporary character while this skill is active.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="character-skill">Skill</Label>
            <Select value={skillId} onValueChange={setSkillId}>
              <SelectTrigger id="character-skill" className="w-full">
                <SelectValue placeholder="Choose a skill" />
              </SelectTrigger>
              <SelectContent>
                {skillOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transformation-pet">Transformation character</Label>
            <Select value={transformationPetId} onValueChange={setTransformationPetId}>
              <SelectTrigger id="transformation-pet" className="w-full">
                <SelectValue placeholder="Choose a character" />
              </SelectTrigger>
              <SelectContent>
                {characterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="demo-destination-skill">Demo destination</Label>
            <Select value={demoDestinationSkillId} onValueChange={setDemoDestinationSkillId}>
              <SelectTrigger id="demo-destination-skill" className="w-full">
                <SelectValue placeholder="Choose a landmark" />
              </SelectTrigger>
              <SelectContent>
                {destinationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void savePolicy()} disabled={saving}>
              {saving ? "Saving…" : "Save characters"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={demoTransformation}
              disabled={!targetEmployeeId}
            >
              Demo in office
            </Button>
          </div>
          {status ? (
            <p className="text-sm text-muted-foreground" role="status">
              {status}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
