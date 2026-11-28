import { describe, expect, it } from "vitest";
import {
  addressOf,
  privateRegistries,
  readNpmrc,
  refusal,
} from "../src/npmrc.mts";

const JFROG = "https://acme.jfrog.io/artifactory/api/npm/npm/";

describe("the names .npmrc's sign-in lines read", () => {
  it("takes the variable an _authToken line reads", () => {
    const n = readNpmrc(
      `@acme:registry=${JFROG}\n//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=\${NPM_TOKEN}\n`,
    );
    expect(n.names).toEqual(["NPM_TOKEN"]);
  });

  it("takes the variable of each sign-in key", () => {
    const n = readNpmrc(
      [
        "//a.example/:_auth=${A}",
        "//b.example/:_password=${B}",
        "//b.example/:username=${C}",
      ].join("\n"),
    );
    expect(n.names).toEqual(["A", "B", "C"]);
  });

  it("takes a variable written with npm's ? fallback", () => {
    expect(readNpmrc("//a.example/:_authToken=${TOKEN?}").names).toEqual([
      "TOKEN",
    ]);
  });

  it("leaves a variable in any other line alone", () => {
    expect(readNpmrc("cache=${HOME}/.npm-cache\n").names).toEqual([]);
  });

  it("leaves an escaped variable alone, as npm does", () => {
    expect(readNpmrc("//a.example/:_authToken=\\${TOKEN}").names).toEqual([]);
    expect(readNpmrc("//a.example/:_authToken=\\\\${TOKEN}").names).toEqual([
      "TOKEN",
    ]);
  });

  it("takes a name once, in the order first read", () => {
    const n = readNpmrc(
      "//b.example/:_authToken=${B}\n//a.example/:_authToken=${A}\n//c.example/:_authToken=${B}\n",
    );
    expect(n.names).toEqual(["B", "A"]);
  });

  it("reads CRLF lines, comments, spaces around =, and a quoted value", () => {
    const n = readNpmrc(
      '# a comment ${X}\r\n; another ${Y}\r\n//a.example/:_authToken = "${TOKEN}"\r\n',
    );
    expect(n.names).toEqual(["TOKEN"]);
  });

  it("leaves a commented-out sign-in line alone, indented or not", () => {
    expect(
      readNpmrc(
        "# //a.example/:_authToken=${OLD}\n  ; //b.example/:_authToken=${OLDER}\n",
      ).names,
    ).toEqual([]);
  });

  it("reads a quoted registry URL without its quotes", () => {
    expect(readNpmrc(`@acme:registry="${JFROG}"`).registries).toEqual([JFROG]);
  });

  it("reads nothing from no file", () => {
    expect(readNpmrc(null)).toEqual({ names: [], signIns: [], registries: [] });
  });
});

describe("the registry a sign-in line is for", () => {
  it("is the registry URL its key starts with, the longest that does", () => {
    const n = readNpmrc(
      [
        "registry=https://acme.example/npm/",
        "@acme:registry=https://acme.example/npm/private/",
        "//acme.example/npm/private/:_authToken=${TOKEN}",
      ].join("\n"),
    );
    expect(addressOf(n, "TOKEN")).toBe("https://acme.example/npm/private/");
  });

  it("is not a registry whose path only prefixes the key's", () => {
    const n = readNpmrc(
      "registry=https://acme.example/npm\n//acme.example/npm2/:_authToken=${TOKEN}",
    );
    expect(addressOf(n, "TOKEN")).toBe("//acme.example/npm2/");
  });

  it("is the key's own host and path when no registry line matches", () => {
    const n = readNpmrc("//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}");
    expect(addressOf(n, "GITHUB_TOKEN")).toBe("//npm.pkg.github.com/");
  });

  it("leaves the public registry out of those Dependabot must know", () => {
    const n = readNpmrc(
      `registry=https://registry.npmjs.org\n@acme:registry=${JFROG}`,
    );
    expect(privateRegistries(n)).toEqual([JFROG]);
  });
});

describe("a name that can't come from a secret", () => {
  it("refuses a GITHUB_ name other than GITHUB_TOKEN", () => {
    expect(refusal("GITHUB_PACKAGES_TOKEN")).toBe(
      ".npmrc reads ${GITHUB_PACKAGES_TOKEN} to sign in, and GitHub refuses a secret whose name starts with GITHUB_. Rename it in .npmrc, then run: kodor sync",
    );
    expect(refusal("GITHUB_TOKEN")).toBeNull();
  });

  it("refuses a name the runner sets for itself", () => {
    expect(refusal("HOME")).toBe(
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: kodor sync",
    );
    for (const name of ["PATH", "CI", "RUNNER_TEMP", "ACTIONS_CACHE_URL"])
      expect(refusal(name)).not.toBeNull();
    expect(refusal("NPM_TOKEN")).toBeNull();
  });
});
