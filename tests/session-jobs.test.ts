// What a cloud session's log shows of the agent: one line for each thing it
// says and each tool it runs, then how it ended.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveOf,
  isJob,
  ownerKindOf,
  publishTicketDeps,
  quietlyWith,
  sessionError,
  shown,
} from "../src/session-jobs.mts";
import { main as ticketMain, ticketDeps } from "../src/ticket.mts";
import { fakeSettings } from "./fake-gh";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

const line = (value: unknown) => shown(JSON.stringify(value));
const said = (...content: object[]) =>
  line({ type: "assistant", message: { content } });

describe("what the log shows of the agent", () => {
  it("is each thing it says and each tool it runs, in order, one line each", () => {
    expect(
      said(
        { type: "text", text: "Reading the ticket.\n\n  Then the code." },
        {
          type: "tool_use",
          name: "Bash",
          input: { command: "cd ../work &&\n  npm test", timeout: 1000 },
        },
      ),
    ).toEqual([
      "Reading the ticket. Then the code.",
      "> Bash: cd ../work && npm test",
    ]);
  });

  it("cuts what a tool was given to 200 characters", () => {
    expect(
      said({
        type: "tool_use",
        name: "Bash",
        input: { command: "x".repeat(201) },
      }),
    ).toEqual([`> Bash: ${"x".repeat(200)}`]);
  });

  it("writes what is not text as JSON, and a tool given nothing with nothing after it", () => {
    expect(
      said(
        { type: "tool_use", name: "Todo", input: { items: [{ a: 1 }] } },
        { type: "tool_use", name: "Wait" },
      ),
    ).toEqual(['> Todo: [{"a":1}]', '> Wait: ""']);
  });

  it("is how it ended, then each command it was refused", () => {
    expect(
      line({
        type: "result",
        subtype: "success",
        num_turns: 12,
        duration_ms: 179_999,
        total_cost_usd: 1.25,
        permission_denials: [
          {
            tool_name: "Read",
            tool_input: { file_path: "/proc/self/environ" },
          },
        ],
      }),
    ).toEqual([
      "Finished (success): 12 turns, 2 minutes, $1.25 at API list prices.",
      "Denied: Read: /proc/self/environ",
    ]);
  });

  it("shows nothing a tool answered, which can hold what a file or a page said", () => {
    expect(
      line({
        type: "user",
        message: { content: [{ type: "tool_result", content: "secret" }] },
      }),
    ).toEqual([]);
    expect(said({ type: "thinking", thinking: "hm" })).toEqual([]);
    expect(line({ type: "system", subtype: "init" })).toEqual([]);
  });

  it.each(["", "not JSON", '{"type": "assis'])(
    "shows nothing for a line that is not JSON, %j",
    (text) => {
      expect(shown(text)).toEqual([]);
    },
  );

  it.each(["null", "7", '"text"', "[]"])(
    "shows nothing for a line of JSON that is no object, %s",
    (text) => {
      expect(shown(text)).toEqual([]);
    },
  );

  it.each([
    ["no message", { type: "assistant" }],
    ["a message with no content", { type: "assistant", message: {} }],
  ])("shows nothing for %s", (_, value) => {
    expect(line(value)).toEqual([]);
  });
});

describe("a ticket command Publish runs for a session", () => {
  const run = (tickets: ReturnType<typeof memoryTickets>["tickets"]) => ({
    settings: fakeSettings,
    open: async () => ({ tickets }),
    openPulls: async () => [],
    startSync: async () => {},
    runner: () => memoryRunner().runner,
    env: { GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "555" },
    sleep: async () => {},
  });

  it("stops the ticket by the claim Prepare made, on another machine", async () => {
    const { tickets, comments } = memoryTickets([{ key: "12" }]);
    const said: string[] = [];
    await ticketMain(["claim", "12"], {
      ...ticketDeps(),
      ...run(tickets),
      claimStore: { read: () => null, write: () => {} },
      out: () => {},
    });
    const claim = (await tickets.record.read("12"))[0].id;

    const code = await ticketMain(["stop", "12", "needs ticket 40"], {
      ...publishTicketDeps({ ticket: "12", claim }),
      ...run(tickets),
      out: (line) => said.push(line),
    });

    expect(said).toEqual(["released"]);
    expect(code).toBe(0);
    expect(comments("12").at(-1)!.body).toContain("needs ticket 40");
  });
});

describe("the jobs of a cloud run", () => {
  it("are known by their names alone, and not by what every object has", () => {
    expect(
      ["prepare", "run", "publish", "next", "each"].every((s) => isJob(s)),
    ).toBe(true);
    for (const step of ["ready", "toString", "constructor", "", undefined])
      expect(isJob(step), String(step)).toBe(false);
  });
});

describe("another repository's files, to hand to a session", () => {
  let dir = "";
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=a", "-c", "user.email=a@example.com", ...args],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "archive-"));
    const work = join(dir, "work");
    mkdirSync(work);
    git(work, "init", "-q", "-b", "trunk");
    writeFileSync(join(work, "a.txt"), "trunk\n");
    git(work, "add", "-A");
    git(work, "commit", "-qm", "one");
    git(work, "switch", "-qc", "12");
    writeFileSync(join(work, "a.txt"), "branch\n");
    git(work, "commit", "-qam", "two");
    git(work, "switch", "-q", "trunk");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const read = (branch: string | null) => {
    const tar = join(dir, "o.tar");
    const made = archiveOf(join(dir, "work"), branch, tar);
    const to = join(dir, "to");
    mkdirSync(to);
    execFileSync("tar", ["-xf", tar, "-C", to]);
    return {
      made,
      names: readdirSync(to),
      text: readFileSync(join(to, "a.txt"), "utf8"),
    };
  };

  it("are its branch's, or its default branch's, with no history", () => {
    expect(read(null)).toEqual({
      made: true,
      names: ["a.txt"],
      text: "trunk\n",
    });
    rmSync(join(dir, "to"), { recursive: true });
    expect(read("12").text).toBe("branch\n");
  });

  it("are left out when they are too large", () => {
    const tar = join(dir, "o.tar");
    expect(archiveOf(join(dir, "work"), null, tar, {}, 100)).toBe(false);
    expect(existsSync(tar)).toBe(false);
  });
});

describe("the error a session ends with", () => {
  const failed = (result: string) => ({
    type: "result",
    subtype: "success",
    is_error: true,
    result,
  });
  const at = (
    credential: string,
    kind: string | null = "User",
    owner = "sam",
  ) => ({ credential, ownerKind: kind, owner });
  const REFUSED =
    "Failed to authenticate. API Error: 401 OAuth token has expired";

  it("names the token, and that a person replaces it with lunamill init", () => {
    expect(sessionError(failed(REFUSED), at("CLAUDE_CODE_OAUTH_TOKEN"))).toBe(
      `::error::Claude Code refused CLAUDE_CODE_OAUTH_TOKEN: ${REFUSED}. A Claude token lasts a year: run lunamill init to store a new one.`,
    );
  });

  it("names the organization's owner for an organization's repository", () => {
    expect(
      sessionError(
        failed(REFUSED),
        at("CLAUDE_CODE_OAUTH_TOKEN", "Organization", "acme"),
      ),
    ).toBe(
      `::error::Claude Code refused CLAUDE_CODE_OAUTH_TOKEN: ${REFUSED}. A Claude token lasts a year: an owner of acme runs lunamill init --org to store a new one.`,
    );
  });

  it("names an API key with nothing about a year", () => {
    expect(
      sessionError(failed("Invalid API key"), at("ANTHROPIC_API_KEY")),
    ).toBe("::error::Claude Code refused ANTHROPIC_API_KEY: Invalid API key.");
  });

  it("gives any other error in Claude Code's own words, its first line only", () => {
    expect(
      sessionError(
        failed("Reached the turn limit\nand stopped"),
        at("CLAUDE_CODE_OAUTH_TOKEN"),
      ),
    ).toBe("::error::Claude Code: Reached the turn limit");
  });

  it("is no refusal when only a later line of the result reads as one", () => {
    expect(
      sessionError(
        failed(
          "Reached the maximum number of turns\nThe last test failed with HTTP 401 from the mock server",
        ),
        at("CLAUDE_CODE_OAUTH_TOKEN"),
      ),
    ).toBe("::error::Claude Code: Reached the maximum number of turns");
  });

  it("escapes a percent sign, as the runner reads one", () => {
    expect(
      sessionError(failed("50% done"), at("CLAUDE_CODE_OAUTH_TOKEN")),
    ).toBe("::error::Claude Code: 50%25 done");
  });

  it("is nothing for a session that did not end in an error, or one with no words", () => {
    const ok = { ...failed("Done."), is_error: false };
    expect(sessionError(ok, at("CLAUDE_CODE_OAUTH_TOKEN"))).toBeNull();
    expect(sessionError(failed(""), at("CLAUDE_CODE_OAUTH_TOKEN"))).toBeNull();
    expect(
      sessionError({ type: "assistant" }, at("CLAUDE_CODE_OAUTH_TOKEN")),
    ).toBeNull();
  });
});

describe("a line held while the runner reads no commands", () => {
  it("is printed once commands resume, after the token that resumes them", () => {
    const printed: string[] = [];
    let exit = () => {};
    const hold = quietlyWith({
      actions: true,
      token: "t0k",
      out: (l) => printed.push(l),
      onExit: (f) => (exit = f),
    });
    hold("::error::Claude Code: x");
    expect(printed).toEqual(["::stop-commands::t0k"]);
    exit();
    expect(printed).toEqual([
      "::stop-commands::t0k",
      "::t0k::",
      "::error::Claude Code: x",
    ]);
  });
});

describe("who owns the run's repository", () => {
  const event = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), "event-"));
    const path = join(dir, "event.json");
    writeFileSync(path, body);
    return { GITHUB_EVENT_PATH: path };
  };

  it("is the owner's type in the run's event", () => {
    expect(
      ownerKindOf(
        event(
          JSON.stringify({ repository: { owner: { type: "Organization" } } }),
        ),
      ),
    ).toBe("Organization");
    expect(
      ownerKindOf(
        event(JSON.stringify({ repository: { owner: { type: "User" } } })),
      ),
    ).toBe("User");
  });

  it("is unknown outside a run, or for an event it cannot read", () => {
    expect(ownerKindOf({})).toBeNull();
    expect(ownerKindOf(event("not json"))).toBeNull();
    expect(ownerKindOf(event(JSON.stringify({ repository: {} })))).toBeNull();
  });
});
