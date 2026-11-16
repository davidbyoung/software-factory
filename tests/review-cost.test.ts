import { describe, expect, it } from "vitest";
import { main, reviewCost, type Deps } from "../src/review-cost.mts";
import { memoryCodeHost } from "./memory-code-host";

const SHA = "abc123";
const SUMMARY = `Looks good.\n\n<!-- claude-review sha=${SHA} -->\n<!-- review-verdict: ready -->`;

type Host = ReturnType<typeof memoryCodeHost>;

function deps(host: Host, execution: string | Error) {
  const log: string[] = [];
  const asked: string[] = [];
  const d: Deps = {
    codeHost: (repository) => {
      asked.push(repository);
      return host.codeHost;
    },
    env: {
      EXECUTION_FILE: "exec.json",
      PR: "230",
      SHA,
      GITHUB_REPOSITORY: "acme/widgets",
    },
    readFile: () => {
      if (execution instanceof Error) throw execution;
      return execution;
    },
    log: (line) => log.push(line),
  };
  return { d, log, asked };
}

const comment = (id: number, body: string, author: string) => ({
  id,
  body,
  author,
  createdAt: "2026-11-09T12:00:00Z",
});
const bot = (id: number, body: string) =>
  comment(id, body, "github-actions[bot]");
/** A code host whose pull request 230 has these conversation comments. */
const withComments = (
  comments: ReturnType<typeof comment>[],
  fail: Parameters<typeof memoryCodeHost>[1] = {},
) => memoryCodeHost([{ number: 230, comments }], fail);
const COST =
  "\n\nReview cost: $0.03 of the subscription ($0.92 at API list prices).\n\n<!-- cost: 0.92 -->";
const RESULT = JSON.stringify([
  { type: "system" },
  { type: "result", total_cost_usd: 0.9234 },
]);

describe("reviewCost", () => {
  it("takes the execution file's total_cost_usd", () => {
    expect(reviewCost(RESULT)).toEqual({ dollars: 0.9234 });
  });

  it("prices the usage when there is no total, counting a repeated message once", () => {
    const assistant = {
      type: "assistant",
      message: {
        id: "msg_1",
        model: "claude-opus-5-5",
        usage: { output_tokens: 1_000_000 },
      },
    };
    expect(reviewCost(JSON.stringify([assistant, assistant]))).toEqual({
      dollars: 20,
    });
  });

  it("says why when there is no figure", () => {
    expect(reviewCost("[]")).toEqual({
      reason: "the execution file has no total_cost_usd and no usage",
    });
    expect(reviewCost("not json")).toEqual({
      reason: "the execution file is not JSON",
    });
  });
});

describe("main", () => {
  it("adds the line and the marker to the newest summary for the commit, on the repository the run names", async () => {
    const OLD = `Old.\n\n<!-- claude-review sha=${SHA} -->`;
    const host = withComments([
      bot(1, OLD),
      bot(2, SUMMARY),
      bot(3, "<!-- claude-review sha=other -->"),
      comment(4, SUMMARY, "someone"),
    ]);
    const { d, asked } = deps(host, RESULT);

    expect(await main(d)).toBe(0);
    expect(host.pull(230).comments.map((c) => c.body)).toEqual([
      OLD,
      `${SUMMARY}${COST}`,
      "<!-- claude-review sha=other -->",
      SUMMARY,
    ]);
    expect(asked).toEqual(["acme/widgets"]);
  });

  it("adds a cost to a summary that only mentions the marker in its prose", async () => {
    const body = `The parser reads \`<!-- cost: -->\` markers.\n\n${SUMMARY}`;
    const host = withComments([bot(2, body)]);
    const { d } = deps(host, RESULT);

    expect(await main(d)).toBe(0);
    expect(host.pull(230).comments[0].body).toBe(`${body}${COST}`);
  });

  it("adds none to a summary that already has a cost", async () => {
    const body = `${SUMMARY}\n\n<!-- cost: 0.50 -->`;
    const host = withComments([bot(2, body)]);
    const { d, log } = deps(host, RESULT);

    expect(await main(d)).toBe(0);
    expect(host.pull(230).comments[0].body).toBe(body);
    expect(log).toEqual(["The summary already has a cost; adding none."]);
  });

  it("logs and passes when there is no summary for the commit", async () => {
    const { d, log } = deps(withComments([]), RESULT);

    expect(await main(d)).toBe(0);
    expect(log).toEqual([`No review cost: no summary comment for ${SHA}.`]);
  });

  it("logs and passes when there is no figure, asking the code host nothing", async () => {
    const host = withComments([bot(2, SUMMARY)]);
    const { d, log, asked } = deps(host, "[]");

    expect(await main(d)).toBe(0);
    expect([...asked, ...host.log]).toEqual([]);
    expect(log[0]).toMatch(/^No review cost: /);
  });

  it("logs and passes when the execution file is missing", async () => {
    const { d, log } = deps(withComments([]), new Error("ENOENT"));

    expect(await main(d)).toBe(0);
    expect(log).toEqual(["No review cost: exec.json could not be read."]);
  });

  it("logs and passes when the inputs are not set", async () => {
    const { d, log } = deps(withComments([]), RESULT);
    d.env = {};

    expect(await main(d)).toBe(0);
    expect(log[0]).toMatch(/is not set\.$/);
  });

  it("warns and passes when the code host refuses the edit", async () => {
    const host = withComments([bot(2, SUMMARY)], {
      fail: { editComment: new Error("HTTP 403") },
    });
    const { d, log } = deps(host, RESULT);

    expect(await main(d)).toBe(0);
    expect(log).toEqual(["::warning::No review cost: HTTP 403"]);
  });
});
