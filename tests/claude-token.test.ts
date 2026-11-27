// The day a Claude token stops working, and the lines that say so.
import { describe, expect, it } from "vitest";
import {
  doctorCheck,
  statusLine,
  tokenDay,
  type TokenDay,
} from "../src/lib/claude-token.mts";
import { render } from "../src/lib/output.mts";

const NOW = new Date("2026-11-27T15:00:00Z");
const at = (stored: string, o: Partial<Parameters<typeof tokenDay>[0]> = {}) =>
  tokenDay({ stored, now: NOW, ...o })!;

describe("tokenDay", () => {
  it("is a year after the day the secret was stored", () => {
    expect(at("2025-12-10T14:50:57Z")).toMatchObject({
      day: "2026-12-10",
      from: "stored",
      left: 13,
      stage: "soon",
    });
  });

  it("rolls 29 February to 1 March", () => {
    expect(at("2028-02-29T00:00:00Z").day).toBe("2029-03-01");
  });

  it("is fine with 31 days left and soon with 30", () => {
    expect(at("2025-12-28T00:00:00Z")).toMatchObject({
      left: 31,
      stage: "fine",
    });
    expect(at("2025-12-27T23:59:59Z")).toMatchObject({
      left: 30,
      stage: "soon",
    });
  });

  it("is soon on the day itself, and over the day after", () => {
    expect(at("2025-11-27T23:00:00Z")).toMatchObject({
      left: 0,
      stage: "soon",
    });
    expect(at("2025-11-26T00:00:00Z")).toMatchObject({
      left: -1,
      stage: "over",
    });
  });

  it("counts from the day it was pasted when that is earlier", () => {
    expect(at("2026-02-01T00:00:00Z", { pasted: "2025-12-10" })).toMatchObject({
      day: "2026-12-10",
      from: "pasted",
    });
    expect(at("2025-12-10T00:00:00Z", { pasted: "2026-02-01" })).toMatchObject({
      day: "2026-12-10",
      from: "stored",
    });
  });

  it("has no day for a date it cannot read", () => {
    expect(tokenDay({ stored: "soon", now: NOW })).toBeNull();
    expect(
      tokenDay({ stored: "2025-12-10T00:00:00Z", pasted: "x", now: NOW }),
    ).toMatchObject({ from: "stored" });
  });
});

const text = (t: TokenDay) => {
  const c = doctorCheck(t);
  return { state: c.state, text: c.text, fix: c.fix };
};

describe("doctorCheck", () => {
  it("passes more than 30 days before the day", () => {
    expect(text(at("2026-11-16T14:50:57Z"))).toEqual({
      state: "pass",
      text: "CLAUDE_CODE_OAUTH_TOKEN stops working by 2027-11-16, a year after it was stored",
      fix: undefined,
    });
  });

  it("looks in the last 30 days, with the fix in the line", () => {
    expect(text(at("2025-12-10T00:00:00Z"))).toEqual({
      state: "unknown",
      text: "CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days, a year after it was stored. Run factory init to replace it",
      fix: undefined,
    });
    expect(text(at("2025-11-28T00:00:00Z")).text).toContain(", in 1 day, ");
    expect(text(at("2025-11-27T00:00:00Z")).text).toContain(", today, ");
  });

  it("fails once the day has passed", () => {
    expect(text(at("2025-11-10T00:00:00Z"))).toEqual({
      state: "fail",
      text: "CLAUDE_CODE_OAUTH_TOKEN stopped working by 2026-11-10, a year after it was stored",
      fix: "Run factory init",
    });
  });

  it("says when it counted from the day it was pasted", () => {
    expect(
      text(at("2026-01-05T00:00:00Z", { pasted: "2025-12-10" })).text,
    ).toBe(
      "CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days, a year after you pasted it. Run factory init to replace it",
    );
  });

  it("names the organization that stored it, and who replaces it", () => {
    const org = { org: "acme" };
    expect(text(at("2026-11-25T00:00:00Z", org)).text).toBe(
      "CLAUDE_CODE_OAUTH_TOKEN stops working by 2027-11-25, a year after acme stored it",
    );
    expect(text(at("2025-12-10T00:00:00Z", org)).text).toBe(
      "CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days, a year after acme stored it. An owner of acme runs factory init --org to replace it",
    );
    expect(text(at("2025-11-10T00:00:00Z", org))).toEqual({
      state: "fail",
      text: "CLAUDE_CODE_OAUTH_TOKEN stopped working by 2026-11-10, a year after acme stored it",
      fix: "an owner of acme runs factory init --org",
    });
  });
});

describe("statusLine", () => {
  const shown = (t: TokenDay) => {
    const line = statusLine(t);
    return line && render(line, false);
  };

  it("says nothing more than 30 days before the day", () => {
    expect(shown(at("2026-11-16T00:00:00Z"))).toBeNull();
  });

  it("warns in the last 30 days, and fails after", () => {
    expect(shown(at("2025-12-10T00:00:00Z"))).toBe(
      "? CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days. Run factory init to replace it",
    );
    expect(shown(at("2025-11-10T00:00:00Z"))).toBe(
      "✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by 2026-11-10. Run factory init",
    );
  });

  it("names the organization's owner in place of factory init", () => {
    expect(shown(at("2025-12-10T00:00:00Z", { org: "acme" }))).toBe(
      "? CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days. An owner of acme runs factory init --org to replace it",
    );
    expect(shown(at("2025-11-10T00:00:00Z", { org: "acme" }))).toBe(
      "✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by 2026-11-10. An owner of acme runs factory init --org to replace it",
    );
  });
});
