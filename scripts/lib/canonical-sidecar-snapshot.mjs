/**
 * Canonical sidecar snapshots for persistence proofs.
 * Object keys and the semantic office-object collection are sorted; all values,
 * including transforms and nested metadata, remain part of the comparison.
 */
function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, deepSortKeys(value[key])]),
  );
}

function compareOfficeObjects(left, right) {
  const leftKey = `${left?.id ?? ""}\u0000${left?.identifier ?? ""}\u0000${left?.meshType ?? ""}`;
  const rightKey = `${right?.id ?? ""}\u0000${right?.identifier ?? ""}\u0000${right?.meshType ?? ""}`;
  return leftKey.localeCompare(rightKey);
}

export function canonicalSidecarSnapshot({ settings, objects }) {
  return JSON.stringify(
    deepSortKeys({
      settings,
      objects: Array.isArray(objects) ? [...objects].sort(compareOfficeObjects) : objects,
    }),
  );
}
