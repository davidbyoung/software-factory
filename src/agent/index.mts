// The coding agent the factory's sessions run in. Claude Code is the only
// one, so the settings name none: the agent that adds a second adds the
// setting.
export { claudeCodeSetup } from "./claude-code.mts";

export const DEFAULT_AGENT = "claude-code" as const;
