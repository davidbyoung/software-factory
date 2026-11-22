// The credential a ticket system keeps on this machine: where it is read
// from, which source wins, and how the file is written and guarded.
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  credentialsPath,
  hasEntry,
  readCredential,
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

describe("where a credential is read from", () => {
  it("is under XDG_CONFIG_HOME when that is set", () => {
    expect(credentialsPath(env)).toBe(
      join(env.XDG_CONFIG_HOME!, "software-factory", "credentials.yaml"),
    );
  });

  it("is under ~/.config otherwise", () => {
    expect(credentialsPath({ HOME: "/h" })).toMatch(
      /\/\.config\/software-factory\/credentials\.yaml$/,
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
