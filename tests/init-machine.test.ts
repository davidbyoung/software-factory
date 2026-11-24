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
import { APP_KEY as ORGANIZATION_KEY } from "../src/init-org.mts";
import { APP_KEY } from "../src/parts.mts";
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
      "claude-code": { [SITE]: { CLAUDE_CODE_OAUTH_TOKEN: AGENT } },
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
      "secret: Paste the token it printed (leave empty to do this later):",
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

describe("the key of an organization's app", () => {
  it("has one name, in the parts and in the organization's setup", () => {
    expect(APP_KEY).toBe(ORGANIZATION_KEY);
  });
});
