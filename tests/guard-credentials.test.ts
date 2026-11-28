// The guard on the credentials file: a session's shell command or file
// tool that reads it is refused, with the lunamill command to run instead,
// and one that only mentions it goes through.
import { describe, expect, it } from "vitest";
import { guard } from "../src/guard.mts";

const REASON =
  "lunamill's credentials file is not for sessions to read. Its commands read it themselves: run the lunamill command you need, such as lunamill ticket view.";

/** A call to `tool` as the hook gets it: Bash through `lunamill guard`, and
 * the file tools through `lunamill guard credentials`. */
async function run(tool: string, toolInput: unknown) {
  const err: string[] = [];
  const code = await guard(
    tool === "Bash" ? "all" : "credentials",
    { tool_name: tool, tool_input: toolInput } as never,
    (t) => err.push(t),
  );
  return { code, err };
}

describe("lunamill guard credentials", () => {
  it.each([
    ["Bash", "Bash", { command: "cat ~/.config/lunamill/credentials.yaml" }],
    [
      "Bash, through $XDG_CONFIG_HOME",
      "Bash",
      { command: 'less "$XDG_CONFIG_HOME/lunamill/credentials.yaml"' },
    ],
    [
      "Read",
      "Read",
      { file_path: "/home/dana/.config/lunamill/credentials.yaml" },
    ],
    [
      "Grep",
      "Grep",
      {
        pattern: "TOKEN",
        path: "/home/dana/.config/lunamill/credentials.yaml",
      },
    ],
    ["Glob", "Glob", { pattern: "**/lunamill/credentials*" }],
    [
      "Bash, by a path relative to the config folder",
      "Bash",
      { command: "cd ~/.config && cat lunamill/credentials.yaml" },
    ],
  ] as const)("refuses %s reading the file", async (_, tool, input) => {
    expect(await run(tool, input)).toEqual({ code: 2, err: [REASON] });
  });

  it.each([
    [
      "a message in quotes",
      "Bash",
      {
        command:
          'lunamill pr comment 67 --body "Say where ~/.config/lunamill/credentials.yaml lives"',
      },
    ],
    [
      "a comment body in a heredoc",
      "Bash",
      {
        command:
          "cat > reply.md <<'EOF'\nThe file is ~/.config/lunamill/credentials.yaml.\nEOF",
      },
    ],
    [
      "a search for the words",
      "Bash",
      { command: "grep -rn lunamill/credentials docs" },
    ],
    [
      "Grep's pattern, searching elsewhere",
      "Grep",
      { pattern: "~/.config/lunamill/credentials.yaml", path: "docs" },
    ],
  ] as const)(
    "lets through %s that only mentions it",
    async (_, tool, input) => {
      expect(await run(tool, input)).toEqual({ code: 0, err: [] });
    },
  );

  it("lets a Bash command through that does not name it", async () => {
    expect(await run("Bash", { command: "cat notes/credentials.md" })).toEqual({
      code: 0,
      err: [],
    });
  });

  it("lets a file read through that does not name it", async () => {
    expect(
      await run("Read", {
        file_path: "/home/dana/notes/credentials.md",
      }),
    ).toEqual({ code: 0, err: [] });
  });
});
