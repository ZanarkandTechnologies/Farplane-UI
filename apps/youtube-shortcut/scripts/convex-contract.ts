/** Checks bridge-to-Convex call arguments against the validators Convex enforces. */
import { getFunctionName } from "convex/server";

export type ValidatorJson = {
  type: string;
  value?: unknown;
  keys?: ValidatorJson;
  values?: FieldJson;
  tableName?: string;
};
type FieldJson = { fieldType: ValidatorJson; optional: boolean };

const CONVEX_ROOT = new URL("../../../convex/", import.meta.url);

/** Reads a function's args validator from Convex source, as `convex function-spec` publishes it. */
export async function sourceArgsValidator(reference: unknown): Promise<ValidatorJson> {
  const [file, name = "default"] = getFunctionName(reference as never).split(":");
  const module = await import(new URL(`${file}.ts`, CONVEX_ROOT).href);
  const registered = module[name] as { exportArgs?: () => string } | undefined;
  if (typeof registered?.exportArgs !== "function") {
    throw new Error(`${file}:${name} is not a registered Convex function`);
  }
  return JSON.parse(registered.exportArgs()) as ValidatorJson;
}

/** Lists every way `value` breaks `validator`; Convex treats an undefined field as absent. */
export function argErrors(validator: ValidatorJson, value: unknown, path = "args"): string[] {
  switch (validator.type) {
    case "any":
      return [];
    case "null":
      return value === null ? [] : [`${path} must be null`];
    case "number":
    case "bigint":
    case "boolean":
    case "string":
      return typeof value === validator.type ? [] : [`${path} must be a ${validator.type}`];
    case "bytes":
      return value instanceof ArrayBuffer ? [] : [`${path} must be bytes`];
    case "id":
      return typeof value === "string" ? [] : [`${path} must be an id for ${validator.tableName}`];
    case "literal":
      return value === validator.value ? [] : [`${path} must be ${JSON.stringify(validator.value)}`];
    case "array":
      return Array.isArray(value)
        ? value.flatMap((item, index) => argErrors(validator.value as ValidatorJson, item, `${path}[${index}]`))
        : [`${path} must be an array`];
    case "record":
      return isPlainObject(value)
        ? Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .flatMap(([key, item]) => [
              ...argErrors(validator.keys as ValidatorJson, key, `${path} key ${key}`),
              ...argErrors((validator.values as FieldJson).fieldType, item, `${path}.${key}`),
            ])
        : [`${path} must be an object`];
    case "object": {
      if (!isPlainObject(value)) return [`${path} must be an object`];
      const fields = validator.value as Record<string, FieldJson>;
      const extra = Object.keys(value)
        .filter((key) => value[key] !== undefined && !(key in fields))
        .map((key) => `${path} has extra field \`${key}\``);
      const declared = Object.entries(fields).flatMap(([key, field]) =>
        value[key] === undefined
          ? field.optional
            ? []
            : [`${path} is missing \`${key}\``]
          : argErrors(field.fieldType, value[key], `${path}.${key}`),
      );
      return [...extra, ...declared];
    }
    case "union": {
      const members = validator.value as ValidatorJson[];
      return members.some((member) => argErrors(member, value, path).length === 0)
        ? []
        : [`${path} matches none of its ${members.length} allowed shapes`];
    }
    default:
      return [`${path} uses unsupported validator type ${validator.type}`];
  }
}

/** Wraps a fake Convex client so tests fail on any call Convex would reject. */
export function withSourceContract<T extends object>(client: T): T {
  const original = client as unknown as Record<string, unknown>;
  const checked: Record<string, unknown> = { ...original };
  for (const kind of ["mutation", "query", "action"]) {
    const call = original[kind];
    if (typeof call !== "function") continue;
    checked[kind] = async (reference: unknown, args: unknown = {}) => {
      const errors = argErrors(await sourceArgsValidator(reference), args);
      if (errors.length > 0) {
        throw new Error(
          `${getFunctionName(reference as never)} would be rejected by Convex: ${errors.join("; ")}`,
        );
      }
      return call.call(original, reference, args);
    };
  }
  return checked as unknown as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
