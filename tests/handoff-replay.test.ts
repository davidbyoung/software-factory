import { describe, expect, it } from "vitest";
import {
  NotHandedError,
  recording,
  replaying,
  type Call,
} from "../src/handoff/replay.mts";
import { NotFoundError } from "../src/tickets/types.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryTickets } from "./memory-tickets";

/** The recorded calls as the session gets them: through a file. */
const handed = (calls: Call[]) => JSON.parse(JSON.stringify(calls)) as Call[];

/** An adapter that fails a test that reaches it. */
const unreachable = <T extends object>(real: T): T =>
  new Proxy(real, {
    get(target, name) {
      const value = Reflect.get(target, name);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const answer = value.apply(target, args);
        if (answer instanceof Promise)
          throw new Error(`${String(name)} was reached`);
        return answer;
      };
    },
  });

describe("what a session reads", () => {
  it("is what was read for it, with nothing reached", async () => {
    const host = memoryCodeHost([
      { number: 31, title: "Add a thing" },
    ]).codeHost;
    const calls: Call[] = [];
    const real = await recording("codeHost", host, calls).get(31);

    const session = replaying("codeHost", unreachable(host), handed(calls));

    expect(await session.get(31)).toEqual(real);
  });

  it("fails by name when it was not read for it", async () => {
    const host = memoryCodeHost([{ number: 31 }, { number: 32 }]).codeHost;
    const calls: Call[] = [];
    await recording("codeHost", host, calls).get(31);

    const session = replaying("codeHost", unreachable(host), handed(calls));

    await expect(session.get(32)).rejects.toThrow(NotHandedError);
  });

  it("tells a ticket that does not exist from one it was not handed", async () => {
    const { tickets } = memoryTickets([]);
    const calls: Call[] = [];
    await recording("tickets", tickets, calls)
      .read("40")
      .catch(() => {});

    const session = replaying("tickets", unreachable(tickets), handed(calls));

    await expect(session.read("40")).rejects.toThrow(NotFoundError);
  });

  it("reads a group of the ticket system's the same way", async () => {
    const { tickets } = memoryTickets([{ key: "12" }]);
    const calls: Call[] = [];
    const real = await recording("tickets", tickets, calls).record.read("12");

    const session = replaying("tickets", unreachable(tickets), handed(calls));

    expect(await session.record.read("12")).toEqual(real);
    await expect(session.record.read("13")).rejects.toThrow(NotHandedError);
  });

  it("still knows what needs no reading, such as how a ticket is written", () => {
    const { tickets } = memoryTickets([]);
    const session = replaying("tickets", unreachable(tickets), []);
    expect(session.ref("12")).toBe(tickets.ref("12"));
  });

  it("has no sign-in for git", () => {
    const host = memoryCodeHost([]).codeHost;
    expect(replaying("codeHost", host, []).gitToken()).toBeNull();
  });

  it("answers a call whether or not its last argument was left out", async () => {
    const { tickets } = memoryTickets([{ key: "12" }]);
    const calls: Call[] = [];
    await recording("tickets", tickets, calls).readAll(undefined);
    const session = replaying("tickets", unreachable(tickets), handed(calls));
    expect(await session.readAll()).toHaveLength(1);
  });
});

describe("a code host of another repository", () => {
  it("answers as it was read, and never with this one's answer", async () => {
    const calls: Call[] = [];
    const own = memoryCodeHost([], { isPrivate: true }).codeHost;
    const web = memoryCodeHost([], { isPrivate: false }).codeHost;
    await recording("codeHost", own, calls).visible();
    await recording("codeHost", web, calls, "acme/web:").visible();
    const of = (prefix?: string) =>
      replaying("codeHost", own, calls, null, prefix).visible();
    expect(await of()).toEqual({ isPrivate: true });
    expect(await of("acme/web:")).toEqual({ isPrivate: false });
    await expect(of("acme/ios:")).rejects.toThrow("was not handed");
  });
});
