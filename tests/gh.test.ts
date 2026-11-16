import { describe, expect, it } from "vitest";
import { failureOf, refusalsIn } from "../src/lib/gh.mts";

describe("failureOf", () => {
  const args = ["api", "-X", "POST", "repos/o/r/pulls", "-f", "title=x"];

  it("ends a refused call's error with the reasons GitHub gave", () => {
    expect(
      failureOf(
        args,
        "gh: Validation Failed (HTTP 422)\n",
        '{"message":"Validation Failed","errors":[{"message":"No commits between main and main"}]}',
      ),
    ).toBe(
      "gh api -X POST repos/o/r/pulls: gh: Validation Failed (HTTP 422): No commits between main and main",
    );
  });

  it("is the call and the CLI's own message when the answer gives no reason", () => {
    expect(failureOf(args, "gh: Not Found (HTTP 404)", "")).toBe(
      "gh api -X POST repos/o/r/pulls: gh: Not Found (HTTP 404)",
    );
  });
});

describe("refusalsIn", () => {
  it("gives the reasons in a refused call's answer", () => {
    expect(
      refusalsIn(
        JSON.stringify({
          message: "Validation Failed",
          errors: [
            { code: "custom", message: "No commits between main and main" },
            "A second reason",
          ],
        }),
      ),
    ).toBe("No commits between main and main; A second reason");
  });

  it.each(["", "not json", "{}", '{"errors":"none"}', '{"errors":[{}]}'])(
    "gives nothing for an answer without reasons: %j",
    (stdout) => {
      expect(refusalsIn(stdout)).toBe("");
    },
  );
});
