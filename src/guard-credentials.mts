// `factory guard credentials`: refuses a session's tool call that names the
// credentials file (`lib/credentials.mts`), on the shell and on the tools
// that read, search, and list files. It stops a careless session or a plain
// prompt injection, not one that builds the path in pieces.

const NAMED = "software-factory/credentials";

export const CREDENTIALS_REFUSAL =
  "The factory's credentials file is not for sessions to read. Its commands read it themselves: run the factory command you need, such as factory ticket view.";

/** Every string in a tool call's input, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(strings);
  return [];
}

/** The refusal when any text in the call's input names the file. */
export function checkCredentials(input: {
  tool_input?: unknown;
}): string | null {
  return strings(input.tool_input).some((s) => s.includes(NAMED))
    ? CREDENTIALS_REFUSAL
    : null;
}
