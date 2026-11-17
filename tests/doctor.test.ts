// `factory doctor`: one line per check, and a failing exit when any fails.
import { describe, expect, it } from "vitest";
import { parseSettings, SettingsError } from "../src/config.mts";
import { main, type DoctorDeps } from "../src/doctor.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

const settings = (raw: Record<string, unknown> = {}) =>
  parseSettings({ version: 1, repository: "acme/site", ...raw }, () => true);

function doctor(o: {
  raw?: Record<string, unknown>;
  invalid?: string;
  outOfStep?: string[];
  installed?: string;
  locked?: string | null;
  secrets?: Record<string, string>;
  columns?: string[];
}) {
  const out: string[] = [];
  const tickets = memoryTickets([], {
    fields: [
      {
        id: "S",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: (o.columns ?? []).map((name) => ({ id: name, name })),
      },
    ],
  }).tickets;
  const d: DoctorDeps = {
    settings: async () => {
      if (o.invalid) throw new SettingsError(o.invalid);
      return settings(o.raw);
    },
    outOfStep: () => o.outOfStep ?? [],
    versions: () => ({
      installed: o.installed ?? "0.2.0",
      locked: o.locked === undefined ? "0.2.0" : o.locked,
    }),
    open: () => ({
      codeHost: memoryCodeHost([], { owner: "dave" }).codeHost,
      runner: memoryRunner({ secrets: o.secrets ?? {} }).runner,
      tickets,
    }),
    out: (line) => out.push(line),
  };
  return { run: () => main([], d), out };
}

const SIX = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
  "Done",
];

describe("factory doctor", () => {
  it("passes a repository with only the basics, listing every part as off", async () => {
    const { run, out } = doctor({});
    expect(await run()).toBe(0);
    expect(out).toEqual([
      "✓ The settings are valid",
      "✓ The factory's files match the settings",
      "✓ Version 0.2.0 is installed, as the repository records",
      "✓ Signed in to the code host as dave",
      "- An automated review of every pull request: off",
      "- A board: off",
      "- Builds in the cloud: off",
      "- Builds that start when you move a card to Ready: off",
      "- Pull requests that merge themselves: off",
      "- Signed commits from cloud builds: off",
    ]);
  });

  it("prints the same lines, word for word, with every part on", async () => {
    const { run, out } = doctor({
      raw: {
        "ci-review": null,
        tickets: { board: 3 },
        builds: { trigger: "own-server" },
        "auto-merge": { allow: ["docs/**"] },
      },
      secrets: {
        CLAUDE_CODE_OAUTH_TOKEN: "x",
        FACTORY_BOARD_TOKEN: "x",
        FACTORY_AUTOMERGE_TOKEN: "x",
        FACTORY_SIGNING_KEY: "x",
      },
      columns: SIX,
    });
    expect(await run()).toBe(0);
    expect(out).toMatchInlineSnapshot(`
      [
        "✓ The settings are valid",
        "✓ The factory's files match the settings",
        "✓ Version 0.2.0 is installed, as the repository records",
        "✓ Signed in to the code host as dave",
        "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request",
        "✓ FACTORY_BOARD_TOKEN is set, for a board",
        "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for builds in the cloud",
        "✓ FACTORY_BOARD_TOKEN is set, for builds in the cloud",
        "✓ FACTORY_BOARD_TOKEN is set, for builds that start when you move a card to Ready",
        "✓ FACTORY_AUTOMERGE_TOKEN is set, for pull requests that merge themselves",
        "✓ FACTORY_SIGNING_KEY is set, for signed commits from cloud builds",
        "✓ Board 3 has every column the settings name",
      ]
    `);
  });

  it("stops at settings it cannot read, and fails", async () => {
    const { run, out } = doctor({ invalid: "tickets.board: must be a number" });
    expect(await run()).toBe(1);
    expect(out).toEqual([
      "✗ The settings are valid: tickets.board: must be a number",
    ]);
  });

  it("fails when the files are out of step, saying what to run", async () => {
    const { run, out } = doctor({ outOfStep: ["a", "b"] });
    expect(await run()).toBe(1);
    expect(out[1]).toBe(
      "✗ The factory's files match the settings: 2 differ. Run npx --no-install factory sync",
    );
  });

  it("tells someone behind the repository's version to install it", async () => {
    const { run, out } = doctor({ installed: "0.1.0", locked: "0.2.0" });
    expect(await run()).toBe(1);
    expect(out[2]).toBe(
      "✗ Version 0.1.0 is installed, but the repository records 0.2.0. Run npm ci",
    );
  });

  it("tells someone ahead of the repository's version to sync", async () => {
    const { run, out } = doctor({ installed: "0.3.0", locked: "0.2.0" });
    expect(await run()).toBe(1);
    expect(out[2]).toBe(
      "✗ Version 0.3.0 is installed, but the repository records 0.2.0. Run npx --no-install factory sync",
    );
  });

  it("checks each secret a part that is on reads", async () => {
    const { run, out } = doctor({
      raw: { "ci-review": null, "auto-merge": { allow: ["docs/**"] } },
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
    });
    expect(await run()).toBe(1);
    expect(out).toContain(
      "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request",
    );
    expect(out).toContain(
      "✗ FACTORY_AUTOMERGE_TOKEN is not set, for pull requests that merge themselves. Run npx --no-install factory init",
    );
  });

  it("passes a board that has every column the settings name", async () => {
    const r = doctor({
      raw: { tickets: { board: 3 } },
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      columns: SIX,
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("✓ Board 3 has every column the settings name");
  });

  it("fails a board that lacks a column, naming it", async () => {
    const r = doctor({
      raw: { tickets: { board: 3 } },
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      columns: ["Backlog", "Done"],
    });
    expect(await r.run()).toBe(1);
    expect(r.out.at(-1)).toMatch(
      /^✗ Board 3: the Status field lacks In refinement .*\. Run npx --no-install factory init$/,
    );
  });
});
