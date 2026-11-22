// `factory guard credentials`: refuses a session's tool call that reads the
// credentials file (`lib/credentials.mts`): a shell command with its path
// as an argument, or a file tool pointed at it. A message or a search that
// only mentions the path goes through. It stops a careless session or a
// plain prompt injection, not one that builds the path in pieces.

export const CREDENTIALS_REFUSAL =
  "The factory's credentials file is not for sessions to read. Its commands read it themselves: run the factory command you need, such as factory ticket view.";

/** The path written as a path: after a folder, as `~/.config/...` or
 * `$XDG_CONFIG_HOME/...` writes it, or as the file itself. */
const PATH =
  /\/software-factory\/credentials|software-factory\/credentials\.yaml/;

/** A shell command with its prose taken out: heredoc bodies, and quoted
 * strings with a space in them, such as a commit message. A quoted string
 * without one is an argument, such as a quoted path, and is unquoted. */
function argumentsOf(command: string): string {
  return `${command}\n`
    .replace(/<<-?[ \t]*(['"]?)(\w+)\1[\s\S]*?\n[ \t]*\2(?=\n|$)/g, "")
    .replace(/"((?:[^"\\]|\\[\s\S])*)"|'([^']*)'/g, (_, d, s) => {
      const inner: string = d ?? s;
      return /\s/.test(inner) ? "''" : inner;
    });
}

/** The fields of a file tool's input that name what it opens or lists:
 * not Grep's pattern, which is what it searches for. */
const OPENED = ["file_path", "path", "notebook_path"];

/** The refusal when the call reads the file. */
export function checkCredentials(input: {
  tool_name?: string;
  tool_input?: unknown;
}): string | null {
  const given = (input.tool_input ?? {}) as Record<string, unknown>;
  const texts =
    typeof given.command === "string"
      ? [argumentsOf(given.command)]
      : [
          ...OPENED.map((k) => given[k]),
          // Glob's pattern is the files it lists.
          input.tool_name === "Glob" ? given.pattern : null,
        ].filter((v): v is string => typeof v === "string");
  return texts.some((t) => PATH.test(t)) ? CREDENTIALS_REFUSAL : null;
}
