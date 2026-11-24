// The credential a ticket system keeps on this machine: where it is read
// from, which source wins, and how the file is written and guarded.
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  credentialsPath,
  hasEntry,
  presetsPath,
  readCredential,
  rememberedPresets,
  rememberPresets,
  writeCredential,
} from "../src/lib/credentials.mts";
import { CredentialError } from "../src/tickets/types.mts";

const NAMES = ["FAKE_TICKETS_EMAIL", "FAKE_TICKETS_TOKEN"];
let env: Record<string, string | undefined>;
const read = (more: Record<string, string> = {}) =>
  readCredential({
    tool: "fake",
    site: "acme.example",
    names: NAMES,
    env: { ...env, ...more },
  });
const write = (values: Record<string, string>, site = "acme.example") =>
  writeCredential({ tool: "fake", site, values, env });
const mode = (p: string) => statSync(p).mode & 0o777;

beforeEach(() => {
  env = { XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "creds-")) };
});
afterEach(() => rmSync(env.XDG_CONFIG_HOME!, { recursive: true, force: true }));

describe("where a credential is read from", () => {
  it("is under XDG_CONFIG_HOME when that is set", () => {
    expect(credentialsPath(env)).toBe(
      join(env.XDG_CONFIG_HOME!, "software-factory", "credentials.yaml"),
    );
  });

  it("is under ~/.config otherwise", () => {
    expect(credentialsPath({})).toBe(
      join(homedir(), ".config", "software-factory", "credentials.yaml"),
    );
  });

  it("takes the environment when every name is set there", () => {
    write({ FAKE_TICKETS_EMAIL: "file@x", FAKE_TICKETS_TOKEN: "file" });
    expect(
      read({ FAKE_TICKETS_EMAIL: "env@x", FAKE_TICKETS_TOKEN: "env" }),
    ).toEqual({
      state: "found",
      source: "env",
      values: { FAKE_TICKETS_EMAIL: "env@x", FAKE_TICKETS_TOKEN: "env" },
    });
  });

  it("takes the file when a name is unset or empty in the environment", () => {
    write({ FAKE_TICKETS_EMAIL: "file@x", FAKE_TICKETS_TOKEN: "file" });
    const file = {
      state: "found",
      source: "file",
      values: { FAKE_TICKETS_EMAIL: "file@x", FAKE_TICKETS_TOKEN: "file" },
    };
    expect(read({ FAKE_TICKETS_EMAIL: "env@x" })).toEqual(file);
    expect(
      read({ FAKE_TICKETS_EMAIL: "env@x", FAKE_TICKETS_TOKEN: "" }),
    ).toEqual(file);
  });

  it("finds nothing with no file, or no entry for the site", () => {
    expect(read()).toEqual({ state: "missing" });
    write({ FAKE_TICKETS_EMAIL: "a", FAKE_TICKETS_TOKEN: "b" }, "other.site");
    expect(read()).toEqual({ state: "missing" });
  });

  it("refuses a file others can read, naming the chmod", () => {
    write({ FAKE_TICKETS_EMAIL: "a", FAKE_TICKETS_TOKEN: "b" });
    chmodSync(credentialsPath(env), 0o644);
    expect(() => read()).toThrow(CredentialError);
    expect(() => read()).toThrow(
      `${credentialsPath(env)} can be read by others, so it was not read. Run: chmod 600 ${credentialsPath(env)}`,
    );
    expect(hasEntry("fake", "acme.example", env)).toBeNull();
  });

  it("refuses a file that is not YAML", () => {
    mkdirSync(join(env.XDG_CONFIG_HOME!, "software-factory"));
    writeFileSync(credentialsPath(env), "fake: [", { mode: 0o600 });
    expect(() => read()).toThrow(/is not valid YAML: .*\. Fix or delete it/);
  });
});

describe("writing the file", () => {
  it("makes the folder 700 and the file 600", () => {
    write({ FAKE_TICKETS_EMAIL: "a", FAKE_TICKETS_TOKEN: "b" });
    expect(mode(credentialsPath(env))).toBe(0o600);
    expect(mode(join(env.XDG_CONFIG_HOME!, "software-factory"))).toBe(0o700);
    expect(readFileSync(credentialsPath(env), "utf8")).toMatch(
      /^# Written by factory init\. Readable only by you\.\n/,
    );
  });

  it("tightens a looser folder", () => {
    const dir = join(env.XDG_CONFIG_HOME!, "software-factory");
    mkdirSync(dir, { mode: 0o755 });
    chmodSync(dir, 0o755);
    write({ FAKE_TICKETS_EMAIL: "a", FAKE_TICKETS_TOKEN: "b" });
    expect(mode(dir)).toBe(0o700);
  });

  it("keeps every other entry", () => {
    write({ FAKE_TICKETS_EMAIL: "a", FAKE_TICKETS_TOKEN: "b" }, "one.site");
    write({ FAKE_TICKETS_EMAIL: "c", FAKE_TICKETS_TOKEN: "d" });
    expect(hasEntry("fake", "one.site", env)).toBe(true);
    expect(read()).toMatchObject({ values: { FAKE_TICKETS_TOKEN: "d" } });
  });
});

describe("a person's own token, which only init reads", () => {
  const TOKEN = { tool: "github", site: "github.com/sam", names: ["token"] };

  it("is read from the file alone, whatever the environment holds under its name", () => {
    writeCredential({ ...TOKEN, values: { token: "from-file" }, env });
    expect(
      readCredential({
        ...TOKEN,
        env: { ...env, token: "from-env" },
        fileOnly: true,
      }),
    ).toEqual({
      state: "found",
      source: "file",
      values: { token: "from-file" },
    });
  });

  it("is missing when only the environment holds it", () => {
    expect(
      readCredential({
        ...TOKEN,
        env: { ...env, token: "from-env" },
        fileOnly: true,
      }),
    ).toEqual({ state: "missing" });
  });

  it("is filed as the ticket shows, by tool, then by host and owner", () => {
    writeCredential({ ...TOKEN, values: { token: "ghp_x" }, env });
    writeCredential({
      tool: "claude-code",
      site: "github.com/sam",
      values: { CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-x" },
      env,
    });
    expect(readFileSync(credentialsPath(env), "utf8")).toContain(
      [
        "github:",
        "  github.com/sam:",
        "    token: ghp_x",
        "claude-code:",
        "  github.com/sam:",
        "    CLAUDE_CODE_OAUTH_TOKEN: sk-ant-oat01-x",
        "",
      ].join("\n"),
    );
  });
});

describe("the presets this machine last chose for an owner", () => {
  const SITE = "github.com/acme";

  it("remembers none before any is recorded", () => {
    expect(rememberedPresets(SITE, env)).toEqual([]);
  });

  it("records an owner's presets beside the credentials file, at mode 600, keeping every other owner's", () => {
    rememberPresets("github.com/sam", ["sam/factory-config"], env);
    rememberPresets(SITE, ["acme/platform", "acme/platform//node"], env);
    expect(presetsPath(env)).toBe(
      join(env.XDG_CONFIG_HOME!, "software-factory", "presets.yaml"),
    );
    expect(mode(presetsPath(env))).toBe(0o600);
    expect(rememberedPresets(SITE, env)).toEqual([
      "acme/platform",
      "acme/platform//node",
    ]);
    expect(rememberedPresets("github.com/sam", env)).toEqual([
      "sam/factory-config",
    ]);
  });

  it("replaces an owner's earlier choice", () => {
    rememberPresets(SITE, ["acme/old"], env);
    rememberPresets(SITE, ["acme/new"], env);
    expect(rememberedPresets(SITE, env)).toEqual(["acme/new"]);
  });

  it("remembers none from a file that is not YAML, and writes over it", () => {
    mkdirSync(join(env.XDG_CONFIG_HOME!, "software-factory"));
    writeFileSync(presetsPath(env), "{ not yaml");
    expect(rememberedPresets(SITE, env)).toEqual([]);
    rememberPresets(SITE, ["acme/platform"], env);
    expect(rememberedPresets(SITE, env)).toEqual(["acme/platform"]);
  });
});
