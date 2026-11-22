// The guard on the credentials file: a session's shell command or file
// read that names it is refused, with the factory command to run instead.
import { describe, expect, it } from "vitest";
import { guard } from "../src/guard.mts";

const REASON =
  "The factory's credentials file is not for sessions to read. Its commands read it themselves: run the factory command you need, such as factory ticket view.";

async function run(which: "all" | "credentials", toolInput: unknown) {
  const err: string[] = [];
  const code = await guard(which, { tool_input: toolInput } as never, (t) =>
    err.push(t),
  );
  return { code, err };
}

describe("factory guard credentials", () => {
  it.each([
    [
      "Bash",
      "all",
      { command: "cat ~/.config/software-factory/credentials.yaml" },
    ],
    [
      "Bash, through $XDG_CONFIG_HOME",
      "all",
      { command: 'less "$XDG_CONFIG_HOME/software-factory/credentials.yaml"' },
    ],
    [
      "Read",
      "credentials",
      { file_path: "/home/dana/.config/software-factory/credentials.yaml" },
    ],
    [
      "Grep",
      "credentials",
      {
        pattern: "TOKEN",
        path: "/home/dana/.config/software-factory/credentials.yaml",
      },
    ],
    ["Glob", "credentials", { pattern: "**/software-factory/credentials*" }],
  ] as const)("refuses %s naming the file", async (_, which, input) => {
    expect(await run(which, input)).toEqual({ code: 2, err: [REASON] });
  });

  it("lets a Bash command through that does not name it", async () => {
    expect(await run("all", { command: "cat notes/credentials.md" })).toEqual({
      code: 0,
      err: [],
    });
  });

  it("lets a file read through that does not name it", async () => {
    expect(
      await run("credentials", {
        file_path: "/home/dana/notes/credentials.md",
      }),
    ).toEqual({ code: 0, err: [] });
  });
});
