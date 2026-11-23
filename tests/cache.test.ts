import { describe, expect, it } from "vitest";
import { cacheRoot as launcherCacheRoot } from "../bin/launch.js";
import { cacheRoot, presetCommitDir } from "../src/lib/cache.mts";

describe("the cache's folder", () => {
  it.each([
    [{}, "/home/sam/.cache/software-factory"],
    [{ XDG_CACHE_HOME: "/var/cache" }, "/var/cache/software-factory"],
    [{ XDG_CACHE_HOME: "" }, "/home/sam/.cache/software-factory"],
  ])("is the launcher's, for %o", (env, folder) => {
    expect(cacheRoot(env, "/home/sam")).toBe(folder);
    expect(launcherCacheRoot(env, "/home/sam")).toBe(folder);
  });

  it("keeps one commit of a preset's repository under its host, owner, and name", () => {
    expect(
      presetCommitDir("/c", "github.com", "acme/factory-config", "3f9c2e1"),
    ).toBe("/c/presets/github.com/acme/factory-config/3f9c2e1");
  });
});
