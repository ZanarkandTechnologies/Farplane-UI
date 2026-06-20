"use client";

import { useMemo } from "react";
import { deriveOfficeSpaceStats } from "@/modules/office/lib/office-space-stats";
import type { OfficeLayoutModel } from "@/modules/office/lib/office-layout";
import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function StatCell(props: {
  label: string;
  value: string | number;
  tone?: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className={`mt-0.5 text-base font-semibold leading-none ${props.tone ?? "text-slate-100"}`}>
        {props.value}
      </div>
      {props.detail ? (
        <div className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">
          {props.detail}
        </div>
      ) : null}
    </div>
  );
}

export function OfficeStatsHud(props: {
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  officeLayout: OfficeLayoutModel;
}) {
  const stats = useMemo(
    () =>
      deriveOfficeSpaceStats({
        employees: props.employees,
        officeObjects: props.officeObjects,
        officeLayout: props.officeLayout,
      }),
    [props.employees, props.officeObjects, props.officeLayout],
  );
  const emptyTone =
    stats.emptyPercent > 0.2
      ? "text-rose-200"
      : stats.emptyPercent > 0.1
        ? "text-amber-200"
        : "text-emerald-200";
  const walkableTone =
    stats.walkablePercent < 0.85
      ? "text-rose-200"
      : stats.walkablePercent < 0.95
        ? "text-amber-200"
        : "text-emerald-200";

  return (
    <div className="pointer-events-auto w-[236px] border border-slate-500/30 bg-slate-950/72 px-3 py-2 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
          Office
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCell label="Empty" value={formatPercent(stats.emptyPercent)} tone={emptyTone} />
        <StatCell
          label="Agents"
          value={stats.totalEmployees}
          detail={`${stats.persistentEmployees} persist / ${stats.ephemeralEmployees} eph`}
        />
        <StatCell label="Walk" value={formatPercent(stats.walkablePercent)} tone={walkableTone} />
      </div>
    </div>
  );
}
