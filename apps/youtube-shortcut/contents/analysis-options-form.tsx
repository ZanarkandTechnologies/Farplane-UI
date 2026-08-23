import type { FormEvent } from "react";
import { BrainCircuit, X } from "lucide-react";
import type { ProjectOption } from "../runtime-protocol.js";
import {
  closeStyle,
  copyStyle,
  fieldLabelStyle,
  inputStyle,
  panelStyle,
  submitStyle,
  textareaStyle,
} from "./analysis-ui-styles.js";

type AnalysisOptionsFormProps = {
  formId: string;
  projectId: string;
  projects: ProjectOption[];
  projectsLoading: boolean;
  projectsError: string;
  instruction: string;
  onProjectIdChange: (value: string) => void;
  onInstructionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** The optional operator context stays separate from the result and control UI. */
export function AnalysisOptionsForm({
  formId,
  projectId,
  projects,
  projectsLoading,
  projectsError,
  instruction,
  onProjectIdChange,
  onInstructionChange,
  onClose,
  onSubmit,
}: AnalysisOptionsFormProps) {
  return (
    <form
      id={formId}
      aria-label="Configure Farplane analysis"
      style={panelStyle}
      onSubmit={onSubmit}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <BrainCircuit aria-hidden="true" size={16} color="var(--farplane-primary)" />
        <strong style={{ fontSize: 13 }}>Analyze with context</strong>
        <button
          className="farplane-control"
          type="button"
          aria-label="Close analysis options"
          style={closeStyle}
          onClick={onClose}
        >
          <X aria-hidden="true" size={15} />
        </button>
      </div>
      <label style={fieldLabelStyle}>
        Project
        <select
          className="farplane-control"
          value={projectId}
          onChange={(event) => onProjectIdChange(event.currentTarget.value)}
          style={inputStyle}
          disabled={projectsLoading}
        >
          <option value="">
            {projectsLoading ? "Loading projects..." : "No project"}
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      {projectsError && <p style={copyStyle}>{projectsError}</p>}
      <label style={fieldLabelStyle}>
        Instruction
        <textarea
          className="farplane-control"
          value={instruction}
          onChange={(event) => onInstructionChange(event.currentTarget.value)}
          placeholder="Focus on distribution angles, extract product claims, compare to my current project..."
          maxLength={2000}
          rows={5}
          style={textareaStyle}
        />
      </label>
      <button className="farplane-control" type="submit" style={submitStyle}>
        Analyze
      </button>
    </form>
  );
}
