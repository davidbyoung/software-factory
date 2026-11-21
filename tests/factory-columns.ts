/** The block of settings that names each state's column by the factory's
 * own name: what init writes for a board it creates. */
export const FACTORY_COLUMNS = {
  backlog: "Backlog",
  refining: "In refinement",
  ready: "Ready",
  building: "In progress",
  review: "In review",
  done: "Done",
} as const;

/** The same block as YAML, indented under `tickets:`. */
export const FACTORY_COLUMNS_YAML = [
  "  columns:",
  ...Object.entries(FACTORY_COLUMNS).map(([k, v]) => `    ${k}: ${v}`),
].join("\n");
