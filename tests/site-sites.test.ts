import { describe, expect, it } from "vitest";
import { parseSettings, type Settings } from "../src/config.mts";
import { sitesToCompare } from "../src/site.mts";
import { CODE_HOST } from "./settings-fixture";
import { into } from "./printed";

const FILES = [
  "apps/web/src/page.tsx",
  "apps/admin/src/page.tsx",
  "packages/ui/src/button.tsx",
  "services/billing/app.py",
];

const settingsOf = (raw: Record<string, unknown>): Settings =>
  parseSettings(
    { version: 2, repository: "o/r", "code-host": CODE_HOST, ...raw },
    () => true,
  );

const SITES = {
  site: [
    {
      start: "npm start",
      url: "http://localhost:$PORT",
      in: "apps/*",
      files: ["./**", "packages/ui/**"],
    },
  ],
  commands: {
    gate: [{ run: "npm test", in: ["apps/*", "packages/*", "services/*"] }],
  },
};

function pick(changed: string[], argv: string[] = [], raw = SITES) {
  const s = settingsOf(raw);
  const out: string[] = [];
  const runs = sitesToCompare({
    sites: s.sites,
    gate: s.commands.gate,
    ignore: s.commands.ignore,
    argv,
    out: into(out),
    git: (args) =>
      args[0] === "diff"
        ? { ok: true, out: changed.join("\n") }
        : args[0] === "merge-base"
          ? { ok: true, out: "b45e\n" }
          : { ok: true, out: args[0] === "rev-parse" ? "x" : "" },
    defaultBranch: "main",
    files: FILES,
    exists: (p) => FILES.some((f) => f.startsWith(`${p}/`)),
  });
  return { folders: runs.map((r) => r.folder), out };
}

describe("which sites factory site compare pictures", () => {
  it("pictures each site a change touches, after a line that says why", () => {
    const { folders, out } = pick(["packages/ui/src/button.tsx"]);
    expect(folders).toEqual(["apps/admin", "apps/web"]);
    expect(out[0]).toBe(
      "site: 2 of 2 pictured, for the 1 file changed since origin/main",
    );
  });

  it("pictures only the site whose folder changed", () => {
    expect(pick(["apps/web/src/page.tsx"]).folders).toEqual(["apps/web"]);
  });

  it("pictures none for a change that touches no site", () => {
    expect(pick(["services/billing/app.py"]).folders).toEqual([]);
  });

  it("pictures every site when a file nothing covers changed", () => {
    const { folders, out } = pick(["tsconfig.base.json"]);
    expect(folders).toEqual(["apps/admin", "apps/web"]);
    expect(out[0]).toBe(
      "site: all 2 pictured, since 1 changed file is in no gate command's files and not in commands.ignore",
    );
  });

  it("pictures the one site --site names, whatever changed", () => {
    expect(pick([], ["--site", "apps/admin"]).folders).toEqual(["apps/admin"]);
  });

  it("refuses --keep without --site when there are several", () => {
    expect(() => pick([], ["--keep"])).toThrow(
      "--keep leaves one site running: name it with --site FOLDER",
    );
  });

  it("pictures one site at the root as it does today, with no plan", () => {
    const { folders, out } = pick(["a.ts"], [], {
      site: { start: "npm start", url: "u" },
    } as never);
    expect(folders).toEqual([null]);
    expect(out).toEqual([]);
  });
});
