import { EventEmitter } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  claudeCodeAgent,
  claudeCodeSetup,
  claudeCodeSetupWith,
  keyFault,
  tokenFault,
  type Spawn,
} from "../src/agent/claude-code.mts";
import type { SecretStep } from "../src/setup.mts";
import { memoryContext } from "./memory-tools";

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
    /** What the child's three streams were started as. */
    stdio: unknown;
    /** The child's environment, when one was given. */
    env: Record<string, string | undefined> | undefined;
    /** The folder's files while the command ran. */
    files: string[];
  }[] = [];
  let killed = false;
  const spawn: Spawn = (command, args, options) => {
    calls.push({
      command,
      args,
      cwd: options.cwd,
      stdio: (options as { stdio?: unknown }).stdio,
      env: (options as { env?: Record<string, string | undefined> }).env,
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

  it("starts claude with standard input closed, so it waits for none and warns of none", async () => {
    const f = fakeSpawn({ stdout: "{}" });
    await claudeCodeAgent(f.spawn).answer(question);
    expect(f.calls[0]!.stdio).toEqual(["ignore", "pipe", "pipe"]);
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

  it("gives the JSON's result as the reason, not a warning on stderr beside it", async () => {
    const f = fakeSpawn({
      code: 1,
      stderr:
        "Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.\n",
      stdout: JSON.stringify({
        is_error: true,
        result:
          "Failed to authenticate: OAuth session expired and could not be refreshed\nmore",
      }),
    });
    expect(await claudeCodeAgent(f.spawn).answer(question)).toEqual({
      failed: {
        code: 1,
        error:
          "Failed to authenticate: OAuth session expired and could not be refreshed",
      },
    });
  });

  it("gives stderr's first line when the JSON's result says nothing", async () => {
    const f = fakeSpawn({
      code: 1,
      stderr: "Invalid API key · Please run /login\n",
      stdout: JSON.stringify({ is_error: true, result: "" }),
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

describe("the token Claude Code's setup asks for", () => {
  /** What the browser gives to paste back into claude setup-token. */
  const CODE = "Xy7_pQ2vLm-9aB#kR4tZ0wE8sD1fG5hJ3nC6uI";
  const TOKEN = "sk-ant-oat01-AbC_dEf-123";
  const KEY = "sk-ant-api03-AbC_dEf-123";
  const COPY =
    'Copy the line claude setup-token printed after "Your OAuth token", and paste that.';
  // No value here has a token's shape, so nothing is ever tried.
  const step = () =>
    claudeCodeSetup.steps!(memoryContext(["cloud"]))[0] as SecretStep;
  /** The line a pasted value is refused with. */
  const refused = (value: string) =>
    step().verify!(value).then(
      () => null,
      (e: Error) => e.message,
    );

  it("says in its prompt which line to copy", () => {
    expect(step().prompt).toBe(
      "Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
    );
  });

  it("refuses the browser's code, and says that is what a value with a # is", async () => {
    expect(await refused(CODE)).toBe(
      `That is not the token: it starts sk-ant-oat01-, and what you pasted starts differently. If it has a # in it, it is the code the browser gave you for claude setup-token. ${COPY}`,
    );
  });

  it("refuses any other value without the sentence about a #", async () => {
    expect(await refused("gho_something-else")).toBe(
      `That is not the token: it starts sk-ant-oat01-, and what you pasted starts differently. ${COPY}`,
    );
  });

  it("says an API key is one, and names the choice it belongs to where there is one", async () => {
    expect(await refused(KEY)).toBe(
      `That is an API key, not the token: the token starts sk-ant-oat01-. ${COPY}`,
    );
    expect(tokenFault(KEY, "An API key")).toBe(
      `That is an API key, not the token: the token starts sk-ant-oat01-. It belongs to the choice "An API key". ${COPY}`,
    );
  });

  it("prints no part of what was pasted", async () => {
    for (const value of [CODE, "gho_something-else", KEY]) {
      const line = (await refused(value))!;
      expect(line).not.toContain(value);
      expect(line).not.toContain(value.slice(0, 12));
      expect(line).not.toContain(value.slice(-12));
    }
  });
});

describe("an API key for Claude Code", () => {
  it("is one that starts sk-ant-api", () => {
    expect(keyFault("sk-ant-api03-AbC_dEf-123")).toBeNull();
  });

  it("is not any other value", () => {
    expect(keyFault("AbC#dEf")).toBe(
      "That is not an API key: one starts sk-ant-api. Paste the key from the Anthropic console.",
    );
  });

  it("is not the token claude setup-token prints, which belongs to the other choice", () => {
    expect(keyFault("sk-ant-oat01-AbC_dEf-123")).toBe(
      "That is the token claude setup-token prints, not an API key: one starts sk-ant-api. Paste the key from the Anthropic console.",
    );
    expect(keyFault("sk-ant-oat01-AbC_dEf-123", "A Claude subscription")).toBe(
      'That is the token claude setup-token prints, not an API key: one starts sk-ant-api. It belongs to the choice "A Claude subscription". Paste the key from the Anthropic console.',
    );
  });
});

describe("trying a pasted credential with Claude Code before it is stored", () => {
  const TOKEN = "sk-ant-oat01-AbC_dEf-123";
  const KEY = "sk-ant-api03-AbC_dEf-123";
  const OK = { stdout: JSON.stringify({ is_error: false, result: "ok" }) };
  const REFUSED = {
    code: 1,
    stderr: "Warning: no stdin data received in 3s, proceeding without it.\n",
    stdout: JSON.stringify({
      is_error: true,
      result:
        "Failed to authenticate. API Error: 401 OAuth access token is invalid.",
    }),
  };
  /** The token's step over a scripted Claude Code, and what it said. */
  const trying = (script: Script, tryMs?: number) => {
    const f = fakeSpawn(script);
    const said: string[] = [];
    const step = claudeCodeSetupWith(f.spawn, { tryMs }).steps!(
      memoryContext(["cloud"]),
    )[0] as SecretStep;
    return { f, said, step, say: (line: string) => void said.push(line) };
  };

  it("says it is trying the token, and stores one Claude Code takes with no more said", async () => {
    const t = trying(OK);
    expect(await t.step.verify!(TOKEN, t.say)).toEqual({ lines: [] });
    expect(t.said).toEqual(["Trying the token..."]);
  });

  it("gives the token in the child's environment, in no argument, with nothing else that could answer for it", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-api03-from-the-shell");
    vi.stubEnv("PATH", "/usr/bin");
    const t = trying(OK);
    await t.step.verify!(TOKEN, t.say);
    expect(t.f.calls).toHaveLength(1);
    const call = t.f.calls[0]!;
    expect(call.command).toBe("claude");
    expect(call.env!.CLAUDE_CODE_OAUTH_TOKEN).toBe(TOKEN);
    expect(call.env!.ANTHROPIC_API_KEY).toBeUndefined();
    expect(call.env!.PATH).toBe("/usr/bin");
    expect(call.args.join(" ")).not.toContain(TOKEN);
    expect(call.args).toContain("-p");
    expect(call.args.slice(call.args.indexOf("--model"))).toEqual(
      expect.arrayContaining(["--model", "haiku"]),
    );
    expect(call.stdio).toEqual(["ignore", "pipe", "pipe"]);
    expect(call.files).toEqual([]);
    expect(existsSync(call.cwd)).toBe(false);
  });

  it("refuses a token Claude Code refuses, with its reason and nothing of the token", async () => {
    const t = trying(REFUSED);
    const error = await t.step.verify!(TOKEN, t.say).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(error).toBe(
      "Claude Code refused that token: API Error: 401 OAuth access token is invalid. If it was printed over two lines, copy both, then paste it again.",
    );
    expect(error).not.toContain(TOKEN.slice(0, 16));
    expect(error).not.toContain(TOKEN.slice(-8));
  });

  it("stores the token untried, and says so, when Claude Code does not answer in time", async () => {
    const t = trying({ hang: true }, 20);
    expect(await t.step.verify!(TOKEN, t.say)).toEqual({
      lines: [
        "Could not try the token (it took longer than 0.02 seconds), so it is stored untried.",
      ],
    });
    expect(t.f.killed()).toBe(true);
  });

  it("stores the token untried when Claude Code cannot be started", async () => {
    const t = trying({ error: "spawn claude ENOENT" });
    expect(await t.step.verify!(TOKEN, t.say)).toEqual({
      lines: [
        "Could not try the token (spawn claude ENOENT), so it is stored untried.",
      ],
    });
  });

  it("stores the token untried when Claude Code fails for a reason that is no refusal", async () => {
    const t = trying({
      code: 1,
      stdout: JSON.stringify({
        is_error: true,
        result: "API Error: Connection error.",
      }),
    });
    expect(await t.step.verify!(TOKEN, t.say)).toEqual({
      lines: [
        "Could not try the token (API Error: Connection error), so it is stored untried.",
      ],
    });
  });

  it("tries nothing that is not shaped as a token", async () => {
    const t = trying(OK);
    await expect(t.step.verify!("gho_something", t.say)).rejects.toThrow(
      "That is not the token",
    );
    expect(t.f.calls).toEqual([]);
    expect(t.said).toEqual([]);
  });

  it("offers an API key in the token's place, tried the same way under its own name", async () => {
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "sk-ant-oat01-from-the-shell");
    const t = trying(OK);
    const key = t.step.or!;
    expect(key.storeAs).toEqual(["ANTHROPIC_API_KEY"]);
    expect(key.prompt).toBe(
      "Paste the API key (leave empty to do this later):",
    );
    expect(key.skipped).toBe("No ANTHROPIC_API_KEY stored.");
    expect(await key.verify!(KEY, t.say)).toEqual({ lines: [] });
    expect(t.said).toEqual(["Trying the API key..."]);
    const call = t.f.calls[0]!;
    expect(call.env!.ANTHROPIC_API_KEY).toBe(KEY);
    expect(call.env!.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(call.args.join(" ")).not.toContain(KEY);
  });

  it("refuses an API key Claude Code refuses, and one that is not shaped as a key without trying it", async () => {
    const t = trying({
      code: 1,
      stdout: JSON.stringify({
        is_error: true,
        result: "Invalid API key · Fix external API key",
      }),
    });
    await expect(t.step.or!.verify!(KEY, t.say)).rejects.toThrow(
      "Claude Code refused that API key: Invalid API key · Fix external API key. Copy the whole key from the Anthropic console, then paste it again.",
    );
    await expect(t.step.or!.verify!("nothing-like-one", t.say)).rejects.toThrow(
      "That is not an API key",
    );
    expect(t.f.calls).toHaveLength(1);
  });
});
