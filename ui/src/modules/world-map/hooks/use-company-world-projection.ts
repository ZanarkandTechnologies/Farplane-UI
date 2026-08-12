/**
 * Bounded Company World query composition.
 * Reuses each project's canonical React Query key/options and isolates missing or failed reads
 * before passing healthy projections to the pure aggregate boundary.
 */

import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  mergeCompanyWorld,
  normalizeCompanyWorldProjectRefs,
} from "../lib/company-world-projection";
import type { CompanyWorldProjection, CompanyWorldProjectRef } from "../types";
import { worldProjectionQuery } from "./use-world-projection";

export type CompanyWorldProjectionSource = {
  projection: CompanyWorldProjection;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

export function useCompanyWorldProjection(
  projectRefs: CompanyWorldProjectRef[],
  enabled: boolean,
): CompanyWorldProjectionSource {
  const normalized = useMemo(() => normalizeCompanyWorldProjectRefs(projectRefs), [projectRefs]);
  const queries = useQueries({
    queries: normalized.refs.map((ref) => ({
      ...worldProjectionQuery(ref.path),
      enabled,
    })),
  });
  const projection = useMemo(
    () =>
      mergeCompanyWorld(
        normalized.refs.map((ref, index) => {
          const query = queries[index];
          return {
            ref,
            projection: query?.data?.projection,
            error: query?.error instanceof Error ? query.error.message : undefined,
          };
        }),
        undefined,
        normalized.warnings,
      ),
    [normalized, queries],
  );
  const refetch = useCallback(
    () => Promise.all(queries.map((query) => query.refetch())),
    [queries],
  );
  return {
    projection,
    isLoading: enabled && queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    refetch,
  };
}
