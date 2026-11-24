// How Claude Code runs a session in the cloud: confined to its own sandbox,
// with the credential it bills kept from every command it runs. Each setting
// was needed for a theft that works without it to fail
// (https://code.claude.com/docs/en/sandboxing).
import type { CloudSession, SessionCommand } from "./types.mts";

/** The credentials Claude Code itself reads, which no command may. */
const CREDENTIALS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"];

export const NPM_REGISTRY = "registry.npmjs.org";

/** The settings as Claude Code reads them. They are passed on the command
 * line, which a repository's own settings cannot loosen. */
export function sandboxSettings(s: CloudSession): object {
  return {
    // A hook runs outside the sandbox.
    disableAllHooks: true,
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: true,
      network: { allowedDomains: [NPM_REGISTRY, ...s.hosts] },
      credentials: {
        envVars: CREDENTIALS.map((name) => ({ name, mode: "deny" })),
      },
      filesystem: {
        allowWrite: [s.work, s.out, s.cache],
        denyWrite: s.readOnly,
      },
    },
    permissions: {
      // The file tools run outside the sandbox.
      deny: [
        "Read(//proc/**)",
        "Read(//sys/**)",
        "Edit(//proc/**)",
        "Edit(//sys/**)",
        "WebFetch",
        "WebSearch",
      ],
    },
  };
}

const READ_TOOLS = ["Bash", "Read", "Glob", "Grep", "Skill"];

/** The command that starts the session, with the settings in `file`. It
 * names no folder with --add-dir, which would keep the session from writing
 * a skill, an agent, or a command in one. */
export function sessionCommand(s: CloudSession, file: string): SessionCommand {
  const tools = s.schema
    ? READ_TOOLS
    : [
        ...READ_TOOLS,
        "Agent",
        "Task",
        `Edit(/${s.work}/**)`,
        `Edit(/${s.out}/**)`,
      ];
  return {
    command: "claude",
    args: [
      "-p",
      s.prompt,
      "--settings",
      file,
      // The default branch's, which the session starts in.
      "--setting-sources",
      "project",
      "--allowedTools",
      tools.join(","),
      "--max-turns",
      String(s.maxTurns),
      ...(s.model ? ["--model", s.model] : []),
      ...(s.schema
        ? ["--output-format", "json", "--json-schema", JSON.stringify(s.schema)]
        : ["--output-format", "stream-json", "--verbose"]),
    ],
  };
}
