import { describe, expect, it } from "vitest";
import {
  allow,
  ask,
  isWrite,
  readRequests,
  type Asked,
  type ThisRun,
} from "../src/handoff/requests.mts";

const build: ThisRun = {
  kind: "build",
  ticket: "12",
  pull: null,
  comments: [],
  branch: "12-add-a-thing",
  base: "abc",
  opened: [],
};
const answer: ThisRun = {
  kind: "answer",
  ticket: "12",
  pull: 31,
  comments: [901, 902],
  branch: "12-add-a-thing",
  base: "abc",
  opened: [],
};
const asked = (...argv: string[]): Asked => ({
  argv,
  files: argv.includes("--body-file") ? { "b.md": "Some text." } : {},
});
const refusal = (a: Asked, run: ThisRun) => {
  const r = allow(a, run);
  return "refused" in r ? r.refused : null;
};

describe("what a session's command is", () => {
  it.each([
    ["ticket", "comment", "12", "--body-file", "b.md"],
    ["ticket", "stop", "12", "a reason"],
    ["pr", "open", "--title", "t", "--body-file", "b.md"],
    ["pr", "reply", "31", "901", "--body-file", "b.md"],
    ["follow-up", "src/a.mts", "what is wrong"],
  ])("a write, when it is factory %s %s", (...argv) => {
    expect(isWrite(argv)).toBe(true);
  });

  it.each([
    ["ticket", "view", "12"],
    ["ticket", "label", "12", "--was-removed", "spec"],
    ["ticket", "refined", "12", "--check"],
    ["pr", "threads", "31"],
    ["gate"],
  ])("a read or local, when it is factory %s %s", (...argv) => {
    expect(isWrite(argv)).toBe(false);
  });

  it("carries the text of the file it names", () => {
    const a = ask(
      ["ticket", "comment", "12", "--body-file", "tmp/b.md"],
      () => "Some text.",
    );
    expect(a).toEqual({
      argv: ["ticket", "comment", "12", "--body-file", "tmp/b.md"],
      files: { "tmp/b.md": "Some text." },
    });
  });
});

describe("what Publish runs of it", () => {
  it.each<[string, Asked, ThisRun]>([
    [
      "a pull request",
      asked("pr", "open", "--title", "t", "--body-file", "b.md"),
      build,
    ],
    [
      "a comment on its ticket",
      asked("ticket", "comment", "12", "--body-file", "b.md"),
      build,
    ],
    ["its ticket's end", asked("ticket", "stop", "12", "needs a key"), build],
    ["a follow-up", asked("follow-up", "src/a.mts", "what is wrong"), build],
    [
      "a reply on its pull request",
      asked("pr", "reply", "31", "901", "--body-file", "b.md"),
      answer,
    ],
    [
      "a thread of its pull request resolved",
      asked("pr", "resolve", "31", "902"),
      answer,
    ],
    [
      "another review of its pull request",
      asked("pr", "review-again", "31"),
      answer,
    ],
  ])("%s", (_, a, run) => {
    expect(refusal(a, run)).toBeNull();
  });

  it.each<[string, string, Asked, ThisRun]>([
    [
      "another ticket's comment",
      "13 is not this run's",
      asked("ticket", "comment", "13", "--body-file", "b.md"),
      build,
    ],
    [
      "another pull request's reply",
      "32 is not this run's",
      asked("pr", "reply", "32", "901", "--body-file", "b.md"),
      answer,
    ],
    [
      "a reply to a comment of another's",
      "999 is not this run's",
      asked("pr", "reply", "31", "999", "--body-file", "b.md"),
      answer,
    ],
    [
      "a thread of another's resolved",
      "999 is not this run's",
      asked("pr", "resolve", "31", "999"),
      answer,
    ],
    [
      "a label",
      "a session can't ask for this",
      asked("pr", "label", "31", "--add", "verdict-override"),
      answer,
    ],
    [
      "a ticket's label",
      "a session can't ask for this",
      asked("ticket", "label", "12", "--add", "spec"),
      build,
    ],
    [
      "a card moved to Ready",
      "a session can't ask for this",
      asked("ticket", "ready", "12"),
      build,
    ],
    [
      "a pull request into another branch",
      "it can't take --base",
      asked(
        "pr",
        "open",
        "--title",
        "t",
        "--body-file",
        "b.md",
        "--base",
        "evil",
      ),
      build,
    ],
    [
      "a pull request that is not a draft",
      "it can't take --ready",
      asked("pr", "open", "--title", "t", "--body-file", "b.md", "--ready"),
      build,
    ],
    [
      "a second pull request",
      "not in this run",
      asked("pr", "open", "--title", "t", "--body-file", "b.md"),
      answer,
    ],
    [
      "an attachment",
      "it can't take --attach",
      asked(
        "ticket",
        "comment",
        "12",
        "--body-file",
        "b.md",
        "--attach",
        "/etc/passwd",
      ),
      build,
    ],
    [
      "a file it did not hand over",
      "/etc/passwd was not handed over",
      {
        argv: ["ticket", "comment", "12", "--body-file", "/etc/passwd"],
        files: {},
      },
      build,
    ],
    [
      "a ticket opened by a build",
      "not in this run",
      asked("ticket", "open", "--title", "t", "--body-file", "b.md"),
      build,
    ],
    [
      "a command that is not the factory's to ask",
      "a session can't ask for this",
      asked("sync"),
      build,
    ],
    [
      "a command with a word left over",
      "it takes fewer words",
      asked("pr", "resolve", "31", "901", "902"),
      answer,
    ],
  ])("never %s", (_, why, a, run) => {
    expect(refusal(a, run)).toMatch(new RegExp(`: ${why}$`));
  });

  it("lets a conflict run open its ticket", () => {
    const a = asked("ticket", "open", "--title", "t", "--body-file", "b.md");
    expect(refusal(a, { ...answer, kind: "conflict" })).toBeNull();
  });

  it("lets a conflict run comment on the ticket it opened before, and a build on no other", () => {
    const a = asked("ticket", "comment", "40", "--body-file", "b.md");
    expect(
      refusal(a, { ...answer, kind: "conflict", opened: ["40"] }),
    ).toBeNull();
    expect(refusal(a, build)).not.toBeNull();
  });

  describe("keeps the marker a run's own comment is found by", () => {
    const posted = (text: string, run: ThisRun) =>
      allow(
        {
          argv: ["pr", "comment", "31", "--body-file", "b.md"],
          files: { "b.md": text },
        },
        run,
      ) as Asked;

    it("for a conflict run that stopped on the commit it started from", () => {
      const run: ThisRun = { ...answer, kind: "conflict" };
      const text = "Why.\n<!-- conflict-stop head=abc -->";
      expect(posted(text, run).files["b.md"]).toContain(
        "<!-- conflict-stop head=abc -->",
      );
    });

    it("and none for another commit, or in another kind of run", () => {
      const run: ThisRun = { ...answer, kind: "conflict" };
      expect(
        posted("<!-- conflict-stop head=other -->", run).files["b.md"],
      ).not.toContain("<!--");
      expect(
        posted("<!-- conflict-stop head=abc -->", answer).files["b.md"],
      ).not.toContain("<!--");
    });
  });

  it("takes every hidden marker out of what it posts", () => {
    const a: Asked = {
      argv: ["pr", "reply", "31", "901", "--body-file", "b.md"],
      files: {
        "b.md":
          "Fixed. <!-- claude-review sha=abc -->and <!-- work-status:\nmerged --> done <!-- never ends",
      },
    };
    const r = allow(a, answer);
    expect(r).toMatchObject({ files: { "b.md": "Fixed. and  done " } });
  });

  it("takes out a marker that taking another out would leave", () => {
    const a: Asked = {
      argv: ["pr", "reply", "31", "901", "--body-file", "b.md"],
      files: { "b.md": "Fixed. <!-<!-- x -->- claude-review sha=abc -->Done." },
    };
    expect(allow(a, answer)).toMatchObject({
      files: { "b.md": "Fixed. Done." },
    });
  });

  it("escapes a comment quoted in code, so it stays readable and is no marker", () => {
    const a: Asked = {
      argv: ["pr", "reply", "31", "901", "--body-file", "b.md"],
      files: { "b.md": "The marker `<!-- agent -->` is read." },
    };
    expect(allow(a, answer)).toMatchObject({
      files: { "b.md": "The marker `&lt;!-- agent --&gt;` is read." },
    });
  });

  it("cuts a title and a body to what it may be", () => {
    const a: Asked = {
      argv: ["pr", "open", "--title", "t".repeat(500), "--body-file", "b.md"],
      files: { "b.md": "b".repeat(90_000) },
    };
    const r = allow(a, build) as Asked;
    expect(r.argv[3]).toHaveLength(200);
    expect(r.files["b.md"]).toHaveLength(60_000);
  });
});

describe("the file a session hands over", () => {
  const one = { argv: ["pr", "resolve", "31", "901"], files: {} };
  it("is read as its commands, in order", () => {
    expect(
      readRequests(JSON.stringify({ version: 1, commands: [one] })),
    ).toEqual([one]);
  });
  it.each([
    ["is not JSON", "no"],
    ["is another version's", JSON.stringify({ version: 2, commands: [] })],
    [
      "has a key it should not",
      JSON.stringify({ version: 1, commands: [], merge: true }),
    ],
    [
      "has a command with a key it should not",
      JSON.stringify({ version: 1, commands: [{ ...one, sudo: true }] }),
    ],
    [
      "has a word that is not text",
      JSON.stringify({
        version: 1,
        commands: [{ argv: ["pr", 1], files: {} }],
      }),
    ],
    [
      "has more than 200 commands",
      JSON.stringify({ version: 1, commands: Array(201).fill(one) }),
    ],
  ])("is refused when it %s", (_, text) => {
    expect(() => readRequests(text)).toThrow();
  });
});
