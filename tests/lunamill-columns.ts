/** The block of settings that names each state's column by lunamill's
 * own name: what init writes for a board it creates. */
export const LUNAMILL_COLUMNS = {
  backlog: "Backlog",
  refining: "In refinement",
  ready: "Ready",
  building: "In progress",
  review: "In review",
  done: "Done",
} as const;

/** The same block as YAML, indented under `tickets:`. */
export const LUNAMILL_COLUMNS_YAML = [
  "  columns:",
  ...Object.entries(LUNAMILL_COLUMNS).map(([k, v]) => `    ${k}: ${v}`),
].join("\n");
