import { EventEmitter } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { claudeCodeAgent, type Spawn } from "../src/agent/claude-code.mts";

type Script = {
  stdout?: string;
  stderr?: string;
  code?: number;
  /** Never exits on its own. */
  hang?: boolean;
  /** Fails to start, as when the command is missing, and never closes. */
  error?: string;
};

/** A spawn that records each call and plays one scripted run. */
function fakeSpawn(script: Script) {
  const calls: {
    command: string;
    args: string[];
    cwd: string;
    /** The folder's files while the command ran. */
    files: string[];
  }[] = [];
  let killed = false;
  const spawn: Spawn = (command, args, options) => {
    calls.push({
      command,
      args,
      cwd: options.cwd,
      files: readdirSync(options.cwd),
    });
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill(): boolean;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      killed = true;
      setImmediate(() => child.emit("close", null));
      return true;
    };
    if (script.error !== undefined)
      setImmediate(() => child.emit("error", new Error(script.error)));
    else if (!script.hang)
      setImmediate(() => {
        child.stdout.end(script.stdout ?? "");
        child.stderr.end(script.stderr ?? "");
        setImmediate(() => child.emit("close", script.code ?? 0));
      });
    return child;
  };
  return { spawn, calls, killed: () => killed };
}

const question = {
  prompt: "Which column?",
  schema: { type: "object" },
  timeoutMs: 1000,
};

describe("Claude Code's answer", () => {
  it("runs claude once with no tools, on haiku, from an empty folder it deletes", async () => {
    const f = fakeSpawn({
      stdout: JSON.stringify({ structured_output: { backlog: "Todo" } }),
    });
    await claudeCodeAgent(f.spawn).answer(question);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    expect(call.command).toBe("claude");
    expect(call.args).toEqual([
      "-p",
      "Which column?",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify({ type: "object" }),
      "--tools",
      "",
      "--model",
      "haiku",
      "--setting-sources",
      "",
    ]);
    expect(call.files).toEqual([]);
    expect(existsSync(call.cwd)).toBe(false);
  });

  it("returns structured_output on exit 0", async () => {
    const f = fakeSpawn({
      stdout: JSON.stringify({
        result: "",
        structured_output: { backlog: "Todo" },
      }),
    });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      answer: { backlog: "Todo" },
    });
  });

  it("parses result as JSON text when there is no structured_output", async () => {
    const f = fakeSpawn({
      stdout: JSON.stringify({ result: '{"backlog":"Todo"}' }),
    });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      answer: { backlog: "Todo" },
    });
  });

  it("answers undefined when stdout is not JSON", async () => {
    const f = fakeSpawn({ stdout: "Sure! Todo." });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      answer: undefined,
    });
  });

  it("returns stderr's first non-empty line on a non-zero exit", async () => {
    const f = fakeSpawn({
      code: 1,
      stderr: "\nInvalid API key · Please run /login\nmore\n",
    });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      failed: { code: 1, error: "Invalid API key · Please run /login" },
    });
  });

  it("falls back to the JSON's result when stderr is empty", async () => {
    const f = fakeSpawn({
      code: 1,
      stdout: JSON.stringify({
        is_error: true,
        result: "Failed to authenticate: OAuth session expired",
      }),
    });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      failed: {
        code: 1,
        error: "Failed to authenticate: OAuth session expired",
      },
    });
  });

  it("returns no error line when it printed none", async () => {
    const f = fakeSpawn({ code: 2 });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      failed: { code: 2, error: null },
    });
  });

  it("says the command failed, and deletes its folder, when it can't start", async () => {
    const f = fakeSpawn({ error: "spawn claude ENOENT" });
    expect(
      await claudeCodeAgent(f.spawn).answer({ ...question, timeoutMs: 5000 }),
    ).toEqual({ failed: { code: 1, error: "spawn claude ENOENT" } });
    expect(existsSync(f.calls[0]!.cwd)).toBe(false);
  });

  it("kills a run past the timeout and says it timed out", async () => {
    const f = fakeSpawn({ hang: true });
    const answer = await claudeCodeAgent(f.spawn).answer({
      ...question,
      timeoutMs: 20,
    });
    expect(answer).toEqual({ timedOut: true });
    expect(f.killed()).toBe(true);
  });

  it("is installed when the claude command is", () => {
    const agent = claudeCodeAgent(fakeSpawn({}).spawn);
    expect(agent.installed((n) => n === "claude")).toBe(true);
    expect(agent.installed(() => false)).toBe(false);
  });
});
