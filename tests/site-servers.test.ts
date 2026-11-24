import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  givenUrls,
  runChecks,
  stopMessage,
  viewsAtOnce,
} from "../src/site.mts";
import { branchDeps } from "../src/lib/default-branch.mts";
import {
  addWorktree,
  defaultBase,
  freePort,
  keep,
  SiteError,
  startSite,
  startSites,
  stopKept,
  stopProcess,
  withPort,
} from "../src/site/servers.mts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" });

const SERVERS = new URL("../src/site/servers.mts", import.meta.url).href;

const SERVER = `node -e "require('http').createServer((q,r)=>r.end('ok')).listen(process.env.PORT)"`;

const pids: number[] = [];
afterEach(() => {
  pids.splice(0).forEach(stopProcess);
});

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "site-servers-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "a.txt"), "a");
  git(dir, "add", ".");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "one");
  return dir;
}

describe("startSite", () => {
  it("starts the command with PORT set and waits for the address", async () => {
    const port = await freePort();
    const site = await startSite({
      start: SERVER,
      url: "http://127.0.0.1:$PORT",
      cwd: tmpdir(),
      minutes: 1,
      port,
    });
    pids.push(site.pid);
    expect(site.url).toBe(`http://127.0.0.1:${port}`);
    expect(await (await fetch(site.url)).text()).toBe("ok");
  });

  it("fails with the last lines the command printed when nothing answers", async () => {
    const port = await freePort();
    const err = await startSite({
      start: "echo about to fail; echo boom >&2; exit 3",
      url: "http://127.0.0.1:$PORT",
      cwd: tmpdir(),
      minutes: 0.05,
      port,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SiteError);
    expect(err.message).toContain("did not answer");
    expect(err.message).toContain("about to fail");
    expect(err.message).toContain("boom");
  });

  it("does not keep the process that started it alive, so --keep can end", async () => {
    const port = await freePort();
    const script = `
      const { startSite } = await import(${JSON.stringify(SERVERS)});
      const site = await startSite({
        start: ${JSON.stringify(SERVER)},
        url: "http://127.0.0.1:$PORT",
        cwd: ${JSON.stringify(tmpdir())},
        minutes: 1,
        port: ${port},
      });
      console.log(site.pid);
    `;
    // A starter that outlives its work is killed here, and the call throws.
    const out = execFileSync("node", ["--input-type=module", "-e", script], {
      encoding: "utf8",
      timeout: 20_000,
    });
    pids.push(Number(out.trim()));
    expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe("ok");
  }, 30_000);

  it("ends the whole process group when stopped", async () => {
    const port = await freePort();
    const site = await startSite({
      start: SERVER,
      url: "http://127.0.0.1:$PORT",
      cwd: tmpdir(),
      minutes: 1,
      port,
    });
    stopProcess(site.pid);
    await new Promise((r) => setTimeout(r, 500));
    await expect(fetch(site.url)).rejects.toThrow();
  });
});

describe("startSites", () => {
  const common = { url: "http://127.0.0.1:$PORT", cwd: tmpdir(), minutes: 1 };

  it("leaves the caller able to stop a site that started when another did not", async () => {
    const [served, failed] = [await freePort(), await freePort()];
    const started: number[] = [];
    const err = await startSites(
      [
        { ...common, start: SERVER, port: served },
        { ...common, start: "exit 1", port: failed },
      ],
      started,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SiteError);
    started.forEach(stopProcess);
    await new Promise((r) => setTimeout(r, 1000));
    await expect(fetch(`http://127.0.0.1:${served}`)).rejects.toThrow();
  });

  it("records a site's process before the site answers, for a run interrupted while it starts", async () => {
    const started: number[] = [];
    const starting = startSites(
      [{ ...common, start: "sleep 30", port: await freePort() }],
      started,
    );
    pids.push(...started);
    expect(started).toHaveLength(1);
    started.forEach(stopProcess);
    await expect(starting).rejects.toBeInstanceOf(SiteError);
  });
});

describe("viewsAtOnce", () => {
  it.each([
    [2, 1],
    [4, 1],
    [8, 3],
    [16, 3],
  ])("on %i cores pictures %i at a time", (cores, views) => {
    expect(viewsAtOnce(cores)).toBe(views);
  });
});

describe("givenUrls", () => {
  it("takes the two sites --before and --after name", () => {
    expect(givenUrls(["--before", "http://b", "--after", "http://a"])).toEqual({
      before: "http://b",
      after: "http://a",
    });
    expect(givenUrls(["--keep"])).toBeNull();
  });

  it.each([
    [["--before", "http://b"], "--after"],
    [["--after", "http://a"], "--before"],
  ])("refuses %j, naming the missing %s", (argv, missing) => {
    expect(() => givenUrls(argv)).toThrow(`${missing} is missing`);
  });
});

describe("withPort", () => {
  it("fills in $PORT", () => {
    expect(withPort("http://localhost:$PORT/x", 41873)).toBe(
      "http://localhost:41873/x",
    );
  });
});

describe("a worktree of the base", () => {
  it("is added, and removed by stop, leaving `git worktree list` as it was", async () => {
    const root = repo();
    const before = git(root, "worktree", "list");
    const dir = addWorktree(root, "main");
    expect(existsSync(join(dir, "a.txt"))).toBe(true);
    expect(git(root, "worktree", "list")).not.toBe(before);
    keep(root, {
      before: { url: "x", pid: 2 ** 22 },
      after: { url: "y", pid: 2 ** 22 },
      worktree: dir,
    });
    expect(stopKept(root)).toBe(true);
    expect(existsSync(dir)).toBe(false);
    expect(git(root, "worktree", "list")).toBe(before);
    expect(stopKept(root)).toBe(false);
  });
});

describe("the base a comparison starts when none is given", () => {
  /** A repository on a feature branch whose `origin/HEAD` says `branch` is
   * the default one. */
  function cloneOf(branch: string): string {
    const dir = repo();
    git(dir, "checkout", "-q", "-b", "feature");
    git(dir, "update-ref", `refs/remotes/origin/${branch}`, "HEAD");
    git(
      dir,
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      `refs/remotes/origin/${branch}`,
    );
    return dir;
  }

  it("is the default branch as origin has it, whatever it is called", async () => {
    const dir = cloneOf("develop");

    expect(await defaultBase(dir, branchDeps(dir, {}))).toBe("origin/develop");
  });

  it("is git's own default branch, as the checkout has it, with no origin remote", async () => {
    const dir = repo();
    git(dir, "config", "init.defaultBranch", "trunk");

    expect(await defaultBase(dir, branchDeps(dir, {}))).toBe("trunk");
  });

  it("fails, naming the fix, when there is an origin remote and nobody can tell", async () => {
    const dir = repo();
    git(dir, "remote", "add", "origin", "https://x.invalid/r");
    const nobody = {
      ...branchDeps(dir, {}),
      host: async (): Promise<string> => {
        throw new Error("offline");
      },
    };

    const failed = defaultBase(dir, nobody);

    await expect(failed).rejects.toBeInstanceOf(SiteError);
    await expect(failed).rejects.toThrow(
      "Could not tell the default branch. Run: git remote set-head origin --auto",
    );
  });
});

describe("the base a comparison starts, in a checkout whose settings have a repository line", () => {
  /** A repository on a feature branch with the remotes `origin`, a fork
   * whose default branch is main, and `upstream`, whose default branch is
   * develop, and the sources of its default branch when its settings name
   * `repository`. */
  function forkOf(repository: string) {
    const dir = repo();
    git(dir, "checkout", "-q", "-b", "feature");
    for (const [remote, name, branch] of [
      ["origin", "dev/web", "main"],
      ["upstream", "acme/web", "develop"],
    ] as const) {
      git(dir, "remote", "add", remote, `https://github.com/${name}.git`);
      git(dir, "update-ref", `refs/remotes/${remote}/${branch}`, "HEAD");
      git(
        dir,
        "symbolic-ref",
        `refs/remotes/${remote}/HEAD`,
        `refs/remotes/${remote}/${branch}`,
      );
    }
    return {
      dir,
      sources: { ...branchDeps(dir, {}), repository: async () => repository },
    };
  }

  it("is the default branch as the remote that is that repository has it", async () => {
    const { dir, sources } = forkOf("acme/web");

    expect(await defaultBase(dir, sources)).toBe("upstream/develop");
  });

  it("fails with the line that names the repository when no remote is that repository's", async () => {
    const { dir, sources } = forkOf("acme/site");

    const failed = defaultBase(dir, sources);

    await expect(failed).rejects.toBeInstanceOf(SiteError);
    await expect(failed).rejects.toThrow(
      "✗ repository: .claude/factory.yaml says acme/site, and no remote here is acme/site. origin is dev/web. Add the remote, or change the line and run factory sync.",
    );
  });
});

describe("runChecks", () => {
  it("gives the command the JSON on its standard input and takes each non-empty line as a finding", () => {
    const out = runChecks(
      tmpdir(),
      [
        `node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('page '+j.pages.join(','));console.log('');console.log('after '+j.after)})"`,
      ],
      { before: "b", after: "a", pages: ["/x/", "/y/"], report: "r" },
    );
    expect(out[0].findings).toEqual(["page /x/,/y/", "after a"]);
  });

  it("lets a check reach a site that logs more than a pipe holds", async () => {
    const port = await freePort();
    const site = await startSite({
      // The write blocks while the pipe is full, as a server's request log does.
      start: `node -e "const cp=require('child_process');require('http').createServer((q,r)=>{cp.execSync('head -c 200000 /dev/zero >&2',{stdio:'inherit'});r.end('ok')}).listen(process.env.PORT)"`,
      url: "http://127.0.0.1:$PORT",
      cwd: tmpdir(),
      minutes: 1,
      port,
    });
    pids.push(site.pid);
    const [check] = runChecks(
      tmpdir(),
      [
        `node -e "fetch('${site.url}',{signal:AbortSignal.timeout(3000)}).then(r=>r.text()).then(t=>console.log(t),()=>console.log('stalled'))"`,
      ],
      {},
    );
    expect(check.findings).toEqual(["ok"]);
  });

  it("ignores the exit code", () => {
    const [ok, bad] = runChecks(tmpdir(), ["echo one", "echo two; exit 9"], {});
    expect(ok.findings).toEqual(["one"]);
    expect(bad.findings).toEqual(["two"]);
  });
});

describe("factory site stop's message", () => {
  it("says it stopped the two sites compare --keep left running", () => {
    expect(stopMessage(true)).toBe(
      "Stopped the 2 sites site compare --keep left running.",
    );
  });

  it("says none were running when it stopped nothing", () => {
    expect(stopMessage(false)).toBe("No sites were left running.");
  });
});
