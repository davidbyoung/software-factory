import { describe, expect, it } from "vitest";
import { writeAccess } from "../src/tickets/github-access.mts";
import { HttpError, type Transport } from "../src/tickets/transport.mts";

const REPO = "acme/widgets";

/** A transport that answers each GET path from `routes`, rejecting with the
 * route's error, and records each path it was asked for. */
function stub(routes: Record<string, unknown>) {
  const paths: string[] = [];
  const t: Transport = {
    async rest<T>(_method: string, path: string) {
      paths.push(path);
      if (!(path in routes)) throw new Error(`unexpected ${path}`);
      const answer = routes[path];
      if (answer instanceof Error) throw answer;
      return answer as T;
    },
    graphql: () => Promise.reject(new Error("no graphql")),
    text: () => Promise.reject(new Error("no text")),
  };
  return { t, paths };
}

const permission = (login: string) =>
  `repos/${REPO}/collaborators/${login}/permission`;

describe("writeAccess", () => {
  it.each([
    ["admin", true],
    ["write", true],
    ["read", false],
    ["none", false],
  ])("reads a permission of %s as %s", async (level, can) => {
    const { t } = stub({ [permission("alice")]: { permission: level } });
    expect(await writeAccess(t, REPO, "alice")).toBe(can);
  });

  it("reads a name that is no account as no access, when the repository can be read", async () => {
    const { t } = stub({
      [permission("nobody")]: new HttpError(404, "Not Found"),
      [`repos/${REPO}`]: { private: false },
    });
    expect(await writeAccess(t, REPO, "nobody")).toBe(false);
  });

  it("rejects on a 404 when the repository itself cannot be read", async () => {
    const { t } = stub({
      [permission("alice")]: new HttpError(404, "Not Found"),
      [`repos/${REPO}`]: new HttpError(404, "Not Found"),
    });
    await expect(writeAccess(t, REPO, "alice")).rejects.toThrow("Not Found");
  });

  it("rejects on any other failure", async () => {
    const { t } = stub({
      [permission("alice")]: new HttpError(500, "Server Error"),
    });
    await expect(writeAccess(t, REPO, "alice")).rejects.toThrow("Server Error");
  });

  it("encodes a bot's login in the path", async () => {
    const { t, paths } = stub({
      [permission("github-actions%5Bbot%5D")]: { permission: "none" },
    });
    expect(await writeAccess(t, REPO, "github-actions[bot]")).toBe(false);
    expect(paths).toEqual([permission("github-actions%5Bbot%5D")]);
  });
});
