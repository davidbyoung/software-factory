// `factory init`, a person's tokens on the machine: the code host's token
// and the coding agent's credential are kept in the credentials file, and
// stored from there in the person's next repository.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import {
  credentialsPath,
  readCredential,
  writeCredential,
} from "../src/lib/credentials.mts";
import { FAKE_EMAIL, FAKE_TOKEN, withFakeTickets } from "./fake-tools";
import { CODE_HOST_YAML } from "./settings-fixture";
import {
  AGENT,
  GOOD,
  init,
  NARROW,
  printsNoSecret,
  type Setup,
} from "./init-harness";

const SITE = "code.example/sam";
const EXPIRED = "tok_expired";
const sam = (over: Partial<Setup> = {}) =>
  init({
    remote: "git@github.com:sam/api.git",
    tokens: {
      [GOOD]: { account: "sam", scopes: ["push", "workflows", "board"] },
    },
    answers: {
      checkbox: [["board", "cloud"]],
      select: ["new"],
      confirm: [true],
      secret: [AGENT, GOOD],
    },
    ...over,
  });
const held = (r: ReturnType<typeof init>, tool: string, name: string) => {
  const found = readCredential({
    tool,
    site: SITE,
    names: [name],
    env: r.env,
    fileOnly: true,
  });
  return found.state === "found" ? found.values[name] : null;
};
const keep = (
  r: ReturnType<typeof init>,
  o: { token?: string; agent?: string },
) => {
  if (o.token)
    writeCredential({
      tool: "github",
      site: SITE,
      values: { token: o.token },
      env: r.env,
    });
  if (o.agent)
    writeCredential({
      tool: "claude-code",
      site: SITE,
      values: { CLAUDE_CODE_OAUTH_TOKEN: o.agent },
      env: r.env,
    });
};

describe("factory init, a person's first repository", () => {
  it("plans storing both tokens on this machine, after the secrets", async () => {
    const r = sam();
    await r.run();
    const at = r.out.findIndex((l) => l.startsWith("  secrets "));
    expect(r.out.slice(at, at + 2)).toEqual([
      "  secrets       CLAUDE_CODE_OAUTH_TOKEN, FACTORY_BOARD_TOKEN",
      `  store         your GitHub token and your Claude token on this machine, in ${credentialsPath(r.env)}`,
    ]);
  });

  it("says whose the token is, and that it is stored for the repository and on this machine", async () => {
    const r = sam();
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "It belongs to sam. Stored for sam/api, and on this machine for your next repository.",
    );
    expect(r.out).toContain(
      "Stored for sam/api, and on this machine for your next repository.",
    );
  });

  it("stores each as a secret and in the file, filed under the tool and the account, printing neither", async () => {
    const r = sam();
    await r.run();
    expect(r.runner.secrets.get("FACTORY_BOARD_TOKEN")).toBe(GOOD);
    expect(r.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
    expect(load(readFileSync(credentialsPath(r.env), "utf8"))).toEqual({
      github: { [SITE]: { token: GOOD } },
      "claude-code": {
        [SITE]: { CLAUDE_CODE_OAUTH_TOKEN: AGENT, pasted: "2026-11-27" },
      },
    });
    printsNoSecret(r.out);
  });

  it("keeps nothing on this machine for a token left for later", async () => {
    const r = sam({
      answers: {
        checkbox: [["board", "cloud"]],
        select: ["new"],
        confirm: [true],
        secret: ["", ""],
      },
    });
    await r.run();
    expect(held(r, "github", "token")).toBeNull();
    expect(held(r, "claude-code", "CLAUDE_CODE_OAUTH_TOKEN")).toBeNull();
  });

  it("asks for no token, and plans no row, with no part that reads one", async () => {
    const r = sam({ answers: { checkbox: [[]], confirm: [true] } });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);
    expect(r.out.join("\n")).not.toMatch(/^ {2}store /m);
  });
});

describe("factory init, a person's next repository", () => {
  const next = (over: Partial<Setup> = {}) =>
    sam({
      remote: "git@github.com:sam/web.git",
      answers: {
        checkbox: [["board", "cloud"]],
        select: ["new"],
        confirm: [true],
      },
      ...over,
    });

  it("asks for neither, stores both from this machine, and says how many secrets", async () => {
    const r = next();
    keep(r, { token: GOOD, agent: AGENT });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);
    expect(r.opened).toEqual([]);
    expect(r.runner.secrets.get("FACTORY_BOARD_TOKEN")).toBe(GOOD);
    expect(r.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
    expect(r.out).toContain(
      "✓ Stored 2 secrets for sam/web from this machine.",
    );
    printsNoSecret(r.out);
  });

  it("plans the secrets and no row for this machine, which already holds them", async () => {
    const r = next();
    keep(r, { token: GOOD, agent: AGENT });
    await r.run();
    expect(r.out).toContain(
      "  secrets       CLAUDE_CODE_OAUTH_TOKEN, FACTORY_BOARD_TOKEN",
    );
    expect(r.out.join("\n")).not.toMatch(/^ {2}store /m);
  });

  it("counts every name the one token is stored under", async () => {
    const r = next({
      answers: {
        checkbox: [["board", "cloud", "auto-merge"]],
        select: ["new"],
        input: ["docs/**"],
        confirm: [true],
      },
    });
    keep(r, { token: GOOD, agent: AGENT });
    await r.run();
    expect(r.out).toContain(
      "✓ Stored 3 secrets for sam/web from this machine.",
    );
  });

  it("asks only for the one this machine does not hold, and keeps that one too", async () => {
    const r = next({
      answers: {
        checkbox: [["board", "cloud"]],
        select: ["new"],
        confirm: [true],
        secret: [AGENT],
      },
    });
    keep(r, { token: GOOD });
    await r.run();
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([
      "secret: Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
    ]);
    expect(r.out).toContain(
      `  store         your Claude token on this machine, in ${credentialsPath(r.env)}`,
    );
    expect(r.out).toContain("✓ Stored 1 secret for sam/web from this machine.");
    expect(held(r, "claude-code", "CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
  });

  it("gives the signing key to the account the token on this machine belongs to", async () => {
    const r = next({
      answers: {
        checkbox: [["cloud", "signing"]],
        confirm: [true],
      },
    });
    keep(r, { token: GOOD, agent: AGENT });
    await r.run();
    expect(r.out.join("\n")).toContain("Add this public key to sam,");
  });

  it("reads neither from the environment, which holds one under the same name", async () => {
    const r = next({
      env: { CLAUDE_CODE_OAUTH_TOKEN: "from-env", token: "from-env" },
      answers: {
        checkbox: [["board", "cloud"]],
        select: ["new"],
        confirm: [true],
        secret: ["", ""],
      },
    });
    await r.run();
    expect(r.out).toContain("  This machine   no GitHub token for cloud runs");
    expect(r.runner.secrets.size).toBe(0);
  });
});

describe("factory init, a token on this machine that no longer serves", () => {
  const stale = (token: string, parts: string[] = ["board", "cloud"]) => {
    const r = sam({
      remote: "git@github.com:sam/web.git",
      tokens: {
        [GOOD]: { account: "sam", scopes: ["push", "workflows", "board"] },
        [NARROW]: { account: "sam", scopes: ["push", "workflows"] },
        tok_bare: { account: "sam", scopes: [] },
      },
      answers: {
        checkbox: [parts],
        select: ["new"],
        confirm: [true],
        secret: [GOOD],
      },
    });
    keep(r, { token, agent: AGENT });
    return r;
  };
  const QUESTION = "? secret: Paste it (leave empty to do this later):";

  it("says the code host refused it, then asks as usual, and the pasted one replaces it in the file", async () => {
    const r = stale(EXPIRED);
    expect(await r.run()).toBe(0);
    const at = r.transcript.indexOf(
      "GitHub refused the token on this machine for sam. It may have expired.",
    );
    expect(r.transcript.slice(at - 1, at + 5)).toEqual([
      "",
      "GitHub refused the token on this machine for sam. It may have expired.",
      "",
      "An access token: opening https://code.example/tokens/new?scopes=push,workflows,board&note=software factory: sam/web",
      "Check that push, workflows, and board are ticked, choose an expiry, and generate it.",
      QUESTION,
    ]);
    expect(r.opened).toHaveLength(1);
    expect(held(r, "github", "token")).toBe(GOOD);
    expect(r.runner.secrets.get("FACTORY_BOARD_TOKEN")).toBe(GOOD);
    expect(r.out.join("\n")).not.toContain(EXPIRED);
  });

  it("names the scope it lacks, and what needs it", async () => {
    const r = stale(NARROW);
    await r.run();
    expect(r.out).toContain(
      "The token on this machine for sam lacks board, which a board needs.",
    );
    expect(held(r, "github", "token")).toBe(GOOD);
  });

  it("names every scope it lacks, and each thing that needs one", async () => {
    const r = stale("tok_bare");
    await r.run();
    expect(r.out).toContain(
      "The token on this machine for sam lacks push, workflows, and board, which a build and a board need.",
    );
  });

  it("plans storing the replacement on this machine, and stores the agent's from it", async () => {
    const r = stale(EXPIRED);
    await r.run();
    expect(r.out).toContain(
      `  store         your GitHub token on this machine, in ${credentialsPath(r.env)}`,
    );
    expect(r.out).toContain("✓ Stored 1 secret for sam/web from this machine.");
  });

  it("serves a part that needs no more than it has", async () => {
    const r = stale(NARROW, ["cloud"]);
    await r.run();
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);
    expect(r.runner.secrets.get("FACTORY_BUILD_TOKEN")).toBe(NARROW);
  });
});

describe("factory init, a stop after it stored a credential on this machine", () => {
  const SITE_ADDRESS = "acme.example";
  const again = (confirm: boolean[]) =>
    init({
      tools: (b, t) => withFakeTickets(b, t, true, { credential: true }),
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: ${SITE_ADDRESS}\nspecs: none\n`,
      secrets: { [FAKE_EMAIL]: "ci@acme.example", [FAKE_TOKEN]: "ci" },
      answers: {
        input: ["dana@acme.example"],
        secret: ["t0k3n-dana"],
        checkbox: [[]],
        confirm,
      },
    });
  const kept = (r: ReturnType<typeof init>) =>
    readCredential({
      tool: "fake",
      site: SITE_ADDRESS,
      names: [FAKE_EMAIL, FAKE_TOKEN],
      env: r.env,
    }).state;

  it("says nothing else changed when told not to go ahead, since the credential is stored", async () => {
    // Change the parts: yes. Replace the secrets: no. Go ahead: no.
    const r = again([true, false, false]);
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("It belongs to Fake User. Stored on this machine.");
    expect(kept(r)).toBe("found");
    expect(r.out.at(-1)).toBe("Nothing else changed.");
    expect(r.out).not.toContain("Nothing changed.");
  });

  it("says nothing changed when the credential was left empty and the parts are left as they are", async () => {
    const r = init({
      tools: (b, t) => withFakeTickets(b, t, true, { credential: true }),
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: ${SITE_ADDRESS}\nspecs: none\n`,
      secrets: { [FAKE_EMAIL]: "ci@acme.example", [FAKE_TOKEN]: "ci" },
      answers: { input: [""], confirm: [false] },
    });
    expect(await r.run()).toBe(0);
    expect(kept(r)).toBe("missing");
    expect(r.out.at(-1)).toBe("Nothing changed.");
  });

  it("says nothing else changed there once the credential is stored", async () => {
    const r = again([false]);
    expect(await r.run()).toBe(0);
    expect(kept(r)).toBe("found");
    expect(r.out.at(-1)).toBe("Nothing else changed.");
  });

  it("says nothing else changed when a later stop is a preset that is refused", async () => {
    const r = init({
      argv: ["--preset", "acme/none"],
      tools: (b, t) => withFakeTickets(b, t, true, { credential: true }),
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: ${SITE_ADDRESS}\nspecs: none\n`,
      secrets: { [FAKE_EMAIL]: "ci@acme.example", [FAKE_TOKEN]: "ci" },
      answers: {
        input: ["dana@acme.example"],
        secret: ["t0k3n-dana"],
        confirm: [true],
      },
    });
    expect(await r.run()).toBe(1);
    expect(kept(r)).toBe("found");
    expect(r.out.slice(-2)).toEqual([
      "acme/none: not found, or private.",
      "Nothing else changed.",
    ]);
  });

  it("says nothing changed when the credential was left empty, so none was stored", async () => {
    const r = init({
      tools: (b, t) => withFakeTickets(b, t, true, { credential: true }),
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: ${SITE_ADDRESS}\nspecs: none\n`,
      secrets: { [FAKE_EMAIL]: "ci@acme.example", [FAKE_TOKEN]: "ci" },
      answers: {
        input: [""],
        checkbox: [[]],
        confirm: [true, false, false],
      },
    });
    expect(await r.run()).toBe(0);
    expect(kept(r)).toBe("missing");
    expect(r.out.at(-1)).toBe("Nothing changed.");
  });
});

describe("factory init, a Claude token in its last 30 days", () => {
  const OLD = "sk-ant-oat01-old";
  const NEAR =
    "CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days: a Claude token lasts a year.";
  const MAKE = "confirm: Make a new one now? Press Enter for yes:";
  const PASTE =
    "secret: Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):";
  const near = (confirm: boolean[], over: Partial<Setup> = {}) =>
    sam({
      settings: `version: 2\nrepository: sam/api\n${CODE_HOST_YAML}\n`,
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: OLD, FACTORY_BOARD_TOKEN: GOOD },
      stored: { CLAUDE_CODE_OAUTH_TOKEN: "2025-12-10T14:50:57Z" },
      answers: { checkbox: [["cloud"]], confirm, secret: [AGENT] },
      ...over,
    });

  it("says when it stops working, makes a new one on yes, and keeps it on this machine with the day", async () => {
    const r = near([true, false, true]);
    expect(await r.run()).toBe(0);
    const at = r.out.indexOf(NEAR);
    expect(at).toBeGreaterThan(-1);
    expect(r.asked.filter((q) => q.startsWith("confirm:"))).toEqual([
      MAKE,
      "confirm: 1 secret these parts read is already set. Replace it?",
      "confirm: Go ahead?",
    ]);
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([PASTE]);
    expect(r.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
    expect(held(r, "claude-code", "CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
    expect(held(r, "claude-code", "pasted")).toBe("2026-11-27");
    const stored = r.out.indexOf(
      "Stored for sam/api, and on this machine for your next repository.",
    );
    expect(r.out[stored + 1]).toBe(
      "Each of your other repositories keeps the old token until you run factory init there. It stores this one from your machine.",
    );
    printsNoSecret(r.out);
  });

  it("replaces nothing on no, and a yes to Replace it? does not ask for the token again", async () => {
    const no = near([false, false, true]);
    await no.run();
    expect(no.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(OLD);
    expect(no.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);

    const replace = near([false, true, true], {
      answers: {
        checkbox: [["cloud"]],
        confirm: [false, true, true],
        secret: [GOOD],
      },
    });
    await replace.run();
    expect(replace.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(OLD);
    expect(replace.asked.filter((q) => q.startsWith("secret:"))).toEqual([
      "secret: Paste it (leave empty to do this later):",
    ]);
  });

  it("offers the newer token this machine holds, and stores it with nothing to paste", async () => {
    const r = near([true, false, true]);
    writeCredential({
      tool: "claude-code",
      site: SITE,
      values: { CLAUDE_CODE_OAUTH_TOKEN: AGENT, pasted: "2026-11-20" },
      env: r.env,
    });
    await r.run();
    expect(r.asked).toContain(
      "confirm: Store the one on this machine, pasted on 2026-11-20, in its place? Press Enter for yes:",
    );
    expect(r.asked).not.toContain(MAKE);
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);
    expect(r.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
    expect(r.out).toContain("✓ Stored 1 secret for sam/api from this machine.");
  });

  it("asks nothing about a token more than 30 days from its day", async () => {
    const r = near([false, true], {
      stored: { CLAUDE_CODE_OAUTH_TOKEN: "2026-11-16T14:50:57Z" },
    });
    await r.run();
    expect(r.asked).not.toContain(MAKE);
    expect(r.asked).toContain(
      "confirm: 2 secrets these parts read are already set. Replace them?",
    );
  });

  it("does not copy a token in its last 30 days from this machine into a new repository", async () => {
    const r = sam({
      remote: "git@github.com:sam/web.git",
      answers: {
        checkbox: [["board", "cloud"]],
        select: ["new"],
        confirm: [true],
        secret: [AGENT],
      },
    });
    keep(r, { token: GOOD });
    writeCredential({
      tool: "claude-code",
      site: SITE,
      values: { CLAUDE_CODE_OAUTH_TOKEN: OLD, pasted: "2025-12-10" },
      env: r.env,
    });
    await r.run();
    expect(r.out).toContain(
      "The Claude token on this machine stops working by 2026-12-10, in 13 days, so it is not stored here.",
    );
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([PASTE]);
    expect(r.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
  });
});

describe("factory init, the day a Claude token was pasted", () => {
  it("is written beside the token it was given", async () => {
    const r = sam();
    await r.run();
    expect(held(r, "claude-code", "pasted")).toBe("2026-11-27");
  });
});
