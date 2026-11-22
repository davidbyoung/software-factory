// The two files that pick an implementation by the name the settings give.
import { describe, expect, it } from "vitest";
import { openCodeHost } from "../src/code-host/index.mts";
import type { Gh } from "../src/lib/gh.mts";
import { openRunner } from "../src/runner/index.mts";

/** A GitHub CLI that answers every call with nothing and records it. */
function cli() {
  const calls: string[] = [];
  const run: Gh = async (args) => {
    calls.push(args.join(" "));
    return "";
  };
  return { run, calls };
}

describe("openCodeHost", () => {
  it.each(["github", undefined])(
    "picks GitHub for %s, reached through the CLI it is handed",
    async (type) => {
      const gh = cli();
      const host = openCodeHost("acme/widgets", type, gh.run);

      await host.ready(9);

      expect(gh.calls).toEqual(["pr ready 9 --repo acme/widgets"]);
    },
  );

  it("refuses any other name, with the words the settings fail with", () => {
    expect(() => openCodeHost("acme/widgets", "gitlab")).toThrow(
      'code-host.type "gitlab" is not supported. "github" is the only code host built.',
    );
  });
});

describe("openRunner", () => {
  it.each(["github-actions", undefined])(
    "picks GitHub Actions for %s, reached through the CLI it is handed",
    async (name) => {
      const gh = cli();
      const runner = openRunner("acme/widgets", name, gh.run);

      await runner.startBuild("12", "main");

      expect(gh.calls).toEqual([
        "api -X POST repos/acme/widgets/actions/workflows/factory-build.yml/dispatches -f ref=main -f inputs[ticket]=12",
      ]);
    },
  );

  it("refuses any other name, with the words the settings fail with", () => {
    expect(() => openRunner("acme/widgets", "buildkite")).toThrow(
      'builds.runner "buildkite" is not supported. "github-actions" is the only runner built.',
    );
  });
});
