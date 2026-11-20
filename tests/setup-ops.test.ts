// What setting a repository up asks of each interface, on GitHub: secrets
// from the runner, repository settings, tokens, and keys from the code host,
// and boards from the ticket system.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { githubCodeHost } from "../src/code-host/github.mts";
import { NeedsScopeError } from "../src/code-host/types.mts";
import { githubActionsRunner } from "../src/runner/github-actions.mts";
import { githubTickets } from "../src/tickets/github.mts";
import { fetchTransport, ghTransport } from "../src/tickets/transport.mts";

const REPO = "acme/site";

/** A gh that answers by the first route whose pattern matches the joined
 * arguments, and records each call with the JSON body `--input` named. */
function gh(routes: [RegExp, unknown][]) {
  const calls: { line: string; input?: unknown; stdin?: string }[] = [];
  const answer = (line: string) => {
    const route = routes.find(([p]) => p.test(line));
    if (!route) throw new Error(`unexpected gh call: ${line}`);
    if (route[1] instanceof Error) throw route[1];
    return typeof route[1] === "string" ? route[1] : JSON.stringify(route[1]);
  };
  const run = async (args: string[]) => {
    const line = args.join(" ");
    const at = args.indexOf("--input");
    calls.push({
      line,
      ...(at >= 0
        ? { input: JSON.parse(readFileSync(args[at + 1], "utf8")) }
        : {}),
    });
    return answer(line);
  };
  const runIn = async (args: string[], stdin: string) => {
    calls.push({ line: args.join(" "), stdin });
    return answer(args.join(" "));
  };
  return { run, runIn, calls };
}

describe("the runner's secrets, on GitHub Actions", () => {
  it("lists the names of the repository's secrets", async () => {
    const g = gh([
      [
        /actions\/secrets/,
        { total_count: 2, secrets: [{ name: "A" }, { name: "B" }] },
      ],
    ]);
    const runner = githubActionsRunner({
      transport: ghTransport(g.run),
      repository: REPO,
    });
    expect(await runner.secretNames()).toEqual(["A", "B"]);
  });

  it("lists every page of a repository's secrets", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ name: `S${i}` }));
    const g = gh([
      [/secrets\?per_page=100&page=1$/, { secrets: first }],
      [/secrets\?per_page=100&page=2$/, { secrets: [{ name: "LAST" }] }],
    ]);
    const runner = githubActionsRunner({
      transport: ghTransport(g.run),
      repository: REPO,
    });
    const names = await runner.secretNames();
    expect(names).toHaveLength(101);
    expect(names.at(-1)).toBe("LAST");
  });

  it("stores a secret with its value on standard input, never in the arguments", async () => {
    const g = gh([[/^secret set/, ""]]);
    const runner = githubActionsRunner({
      transport: ghTransport(g.run),
      repository: REPO,
      cli: g.runIn,
    });
    await runner.setSecret("FACTORY_BOARD_TOKEN", "ghp_secret");
    expect(g.calls).toEqual([
      {
        line: `secret set FACTORY_BOARD_TOKEN --repo ${REPO}`,
        stdin: "ghp_secret",
      },
    ]);
  });
});

describe("the runner's Dependabot and organization secrets, on GitHub Actions", () => {
  const runner = (g: ReturnType<typeof gh>) =>
    githubActionsRunner({
      transport: ghTransport(g.run),
      repository: REPO,
      cli: g.runIn,
    });

  it("lists the repository's Dependabot secrets", async () => {
    const g = gh([
      [
        /repos\/acme\/site\/dependabot\/secrets/,
        { secrets: [{ name: "NPM_TOKEN" }] },
      ],
    ]);
    expect(await runner(g).dependabotSecretNames()).toEqual(["NPM_TOKEN"]);
  });

  it("stores a Dependabot secret with its value on standard input", async () => {
    const g = gh([[/^secret set/, ""]]);
    await runner(g).setDependabotSecret("NPM_TOKEN", "npm_secret");
    expect(g.calls).toEqual([
      {
        line: `secret set NPM_TOKEN --app dependabot --repo ${REPO}`,
        stdin: "npm_secret",
      },
    ]);
  });

  it("lists the organization's secrets shared with the repository", async () => {
    const g = gh([
      [
        /repos\/acme\/site\/actions\/organization-secrets/,
        { secrets: [{ name: "NPM_TOKEN" }] },
      ],
    ]);
    expect(await runner(g).organizationSecretNames()).toEqual(["NPM_TOKEN"]);
  });

  it("lists the organization's Dependabot secrets that reach the repository, by visibility", async () => {
    const g = gh([
      [
        /orgs\/acme\/dependabot\/secrets\?/,
        {
          secrets: [
            { name: "ALL", visibility: "all" },
            { name: "PRIVATE", visibility: "private" },
            { name: "PICKED", visibility: "selected" },
            { name: "ELSEWHERE", visibility: "selected" },
          ],
        },
      ],
      [
        /secrets\/PICKED\/repositories/,
        { repositories: [{ full_name: REPO }] },
      ],
      [
        /secrets\/ELSEWHERE\/repositories/,
        { repositories: [{ full_name: "acme/other" }] },
      ],
    ]);
    expect(await runner(g).organizationDependabotSecretNames(false)).toEqual([
      "ALL",
      "PICKED",
    ]);
    expect(await runner(g).organizationDependabotSecretNames(true)).toEqual([
      "ALL",
      "PRIVATE",
      "PICKED",
    ]);
  });

  it("answers null when the organization won't list its Dependabot secrets", async () => {
    const g = gh([
      [
        /orgs\/acme\/dependabot\/secrets/,
        new Error("gh: Forbidden (HTTP 403)"),
      ],
    ]);
    expect(await runner(g).organizationDependabotSecretNames(false)).toBeNull();
  });
});

describe("the code host's setup operations, on GitHub", () => {
  const host = (routes: [RegExp, unknown][], f?: typeof fetch) => {
    const g = gh(routes);
    return {
      calls: g.calls,
      host: githubCodeHost({
        transport: ghTransport(g.run),
        repository: REPO,
        fetch: f,
      }),
    };
  };

  it("says who the command-line tool is signed in as", async () => {
    const { host: h } = host([[/^api user$/, { login: "dave" }]]);
    expect(await h.signedInAs()).toBe("dave");
  });

  it("reads a token's account and scopes from GitHub's answer", async () => {
    const seen: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      seen.push(
        `${url} ${(init.headers as Record<string, string>).Authorization}`,
      );
      return new Response(JSON.stringify({ login: "dave" }), {
        status: 200,
        headers: { "x-oauth-scopes": "repo, workflow, project" },
      });
    }) as unknown as typeof fetch;
    const { host: h } = host([], f);
    expect(await h.tokenOwner("ghp_x")).toEqual({
      account: "dave",
      scopes: ["repo", "workflow", "project"],
    });
    expect(seen).toEqual(["https://api.github.com/user Bearer ghp_x"]);
  });

  it("gives no scopes for a token GitHub reports none for, as a fine-grained one", async () => {
    const f = (async () =>
      new Response(JSON.stringify({ login: "dave" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const { host: h } = host([], f);
    expect(await h.tokenOwner("github_pat_x")).toEqual({
      account: "dave",
      scopes: null,
    });
  });

  it("refuses a token GitHub refuses", async () => {
    const f = (async () =>
      new Response(JSON.stringify({ message: "Bad credentials" }), {
        status: 401,
      })) as unknown as typeof fetch;
    const { host: h } = host([], f);
    await expect(h.tokenOwner("nope")).rejects.toThrow("Bad credentials");
  });

  it("names the scopes a token needs for what it does", () => {
    const { host: h } = host([]);
    expect(h.scopesFor(["push", "workflows", "board"])).toEqual([
      "repo",
      "workflow",
      "project",
    ]);
  });

  it("gives the page that makes a token with the scopes asked for", () => {
    const { host: h } = host([]);
    expect(h.newTokenPage(["repo", "workflow"], "factory acme/site")).toBe(
      "https://github.com/settings/tokens/new?scopes=repo,workflow&description=factory%20acme%2Fsite",
    );
  });

  it("gives the page that installs the app the review posts through", () => {
    const { host: h } = host([]);
    expect(h.reviewAppPage()).toBe(
      "https://github.com/apps/claude/installations/new",
    );
  });

  it("turns on auto-merge for the repository", async () => {
    const { host: h, calls } = host([[/-X PATCH repos\/acme\/site /, {}]]);
    await h.allowAutoMerge();
    expect(calls[0].line).toContain("allow_auto_merge=true");
  });

  it("requires a check on the default branch with a ruleset of the name given", async () => {
    const { host: h, calls } = host([
      [/^api repos\/acme\/site\/rulesets/, []],
      [/-X POST repos\/acme\/site\/rulesets/, { id: 1 }],
    ]);
    await h.requireCheck("Software factory", "Review verdict");
    expect(calls[1].input).toEqual({
      name: "Software factory",
      target: "branch",
      enforcement: "active",
      conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [{ context: "Review verdict" }],
            strict_required_status_checks_policy: false,
          },
        },
      ],
    });
  });

  it("leaves a ruleset of that name as it is", async () => {
    const { host: h, calls } = host([
      [
        /^api repos\/acme\/site\/rulesets/,
        [{ id: 3, name: "Software factory" }],
      ],
    ]);
    await h.requireCheck("Software factory", "Review verdict");
    expect(calls).toHaveLength(1);
  });

  it("adds a signing key to the signed-in account", async () => {
    const { host: h, calls } = host([
      [/-X POST user\/ssh_signing_keys/, { id: 1 }],
    ]);
    await h.addSigningKey("factory builds", "ssh-ed25519 AAAA");
    expect(calls[0].line).toContain("title=factory builds");
    expect(calls[0].line).toContain("key=ssh-ed25519 AAAA");
  });

  it("says which permission to ask for when the sign-in cannot add a signing key", async () => {
    const { host: h } = host([
      [
        /user\/ssh_signing_keys/,
        new Error(
          'gh api -X POST user/ssh_signing_keys: HTTP 404: Not Found\nThis API operation needs the "admin:ssh_signing_key" scope.',
        ),
      ],
    ]);
    const error = await h.addSigningKey("t", "k").catch((e) => e);
    expect(error).toBeInstanceOf(NeedsScopeError);
    expect(error.fix).toEqual([
      "gh",
      "auth",
      "refresh",
      "-h",
      "github.com",
      "-s",
      "admin:ssh_signing_key",
    ]);
  });
});

describe("the board's setup operations, on GitHub", () => {
  const boards = (routes: [RegExp, unknown][]) => {
    const g = gh(routes);
    return {
      calls: g.calls,
      board: githubTickets({
        transport: ghTransport(g.run),
        repository: REPO,
        board: null,
      }).board!,
    };
  };

  it("lists the open boards the repository's owner has", async () => {
    const { board } = boards([
      [
        /Boards\(/,
        {
          data: {
            owner: {
              projectsV2: {
                nodes: [
                  { number: 3, title: "Roadmap", closed: false },
                  { number: 1, title: "Old", closed: true },
                ],
              },
            },
          },
        },
      ],
    ]);
    expect(await board.list()).toEqual([{ number: 3, title: "Roadmap" }]);
  });

  it("creates a board under the repository's owner, linked to the repository", async () => {
    const { board, calls } = boards([
      [/Ids\(/, { data: { repository: { id: "R_1", owner: { id: "O_1" } } } }],
      [
        /CreateBoard/,
        { data: { createProjectV2: { projectV2: { number: 7 } } } },
      ],
    ]);
    expect(await board.create("site")).toBe(7);
    const create = calls.find((c) => c.line.includes("CreateBoard"))!.line;
    expect(create).toContain("owner=O_1");
    expect(create).toContain("repo=R_1");
    expect(create).toContain("title=site");
  });

  const status = (options: { id: string; name: string }[]) => ({
    data: {
      owner: {
        projectV2: {
          field: {
            id: "F_status",
            options: options.map((o) => ({
              ...o,
              color: "BLUE",
              description: "",
            })),
          },
        },
      },
    },
  });

  it("adds the columns a board lacks, in order, before the ones it has", async () => {
    const { board, calls } = boards([
      [
        /StatusField\(/,
        status([
          { id: "a", name: "Todo" },
          { id: "b", name: "In Progress" },
          { id: "c", name: "Done" },
        ]),
      ],
      [/updateProjectV2Field/, { data: {} }],
    ]);
    expect(
      await board.addColumns(3, ["Backlog", "In progress", "Done"]),
    ).toEqual(["Backlog"]);
    const update = calls.find((c) =>
      c.line.includes("updateProjectV2Field"),
    )!.line;
    const names = [...update.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(["Backlog", "In Progress", "Done", "Todo"]);
    expect(update).toContain('id: "b"');
    expect(update).toContain('fieldId: "F_status"');
  });

  it("lists a board's columns in the board's order", async () => {
    const { board, calls } = boards([
      [
        /StatusField\(/,
        status([
          { id: "a", name: "Todo" },
          { id: "b", name: "In Progress" },
          { id: "c", name: "Code review" },
          { id: "d", name: "Done" },
        ]),
      ],
    ]);
    expect(await board.columns(3)).toEqual([
      "Todo",
      "In Progress",
      "Code review",
      "Done",
    ]);
    expect(calls[0]!.line).toContain("number=3");
  });

  it("lists no columns for a board without a Status field", async () => {
    const { board } = boards([
      [/StatusField\(/, { data: { owner: { projectV2: { field: null } } } }],
    ]);
    expect(await board.columns(3)).toEqual([]);
  });

  it("changes nothing on a board that has every column", async () => {
    const { board, calls } = boards([
      [/StatusField\(/, status([{ id: "a", name: "Backlog" }])],
    ]);
    expect(await board.addColumns(3, ["Backlog"])).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe("the board's fields, on GitHub", () => {
  it("adds the fields a board lacks, with a select's options", async () => {
    const g = gh([
      [
        /BoardFields\(/,
        {
          data: {
            owner: {
              projectV2: {
                id: "PVT_9",
                fields: { nodes: [{ name: "Status" }, { name: "Session" }] },
              },
            },
          },
        },
      ],
      [/createProjectV2Field/, { data: {} }],
    ]);
    const board = githubTickets({
      transport: ghTransport(g.run),
      repository: REPO,
      board: null,
    }).board!;
    expect(
      await board.addFields(9, [
        { name: "Session", type: "text" },
        { name: "Runs in", type: "select", options: ["Local", "Actions"] },
        { name: "Cost", type: "number" },
      ]),
    ).toEqual(["Runs in", "Cost"]);
    const made = g.calls
      .filter((c) => c.line.includes("createProjectV2Field"))
      .map((c) => c.line);
    expect(made).toHaveLength(2);
    expect(made[0]).toContain('projectId: "PVT_9"');
    expect(made[0]).toContain("dataType: SINGLE_SELECT");
    expect(made[0]).toContain('name: "Actions"');
    expect(made[1]).toContain("dataType: NUMBER");
  });
});

describe("a REST call with a JSON body", () => {
  it("sends it whole over the fetch transport", async () => {
    let sent: unknown;
    const f = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await fetchTransport({ token: "t", fetch: f }).rest("POST", "x", {
      body: { a: [{ b: 1 }] },
    });
    expect(sent).toEqual({ a: [{ b: 1 }] });
  });
});
