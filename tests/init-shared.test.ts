// The prompt that reads a secret, over streams of the test's own in place
// of a terminal: what a paste, typing, and a stop each give it.
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { readSecret } from "../src/init-shared.mts";

const PASTE = "\u001b[200~";
const END = "\u001b[201~";
const ENTER = "\r";
const ON = "\u001b[?2004h";
const OFF = "\u001b[?2004l";

/** Reads a secret from what a terminal would send, chunk by chunk, and
 * records what is written back and each change of the terminal's mode. */
function reading(chunks: string[]) {
  const input = Object.assign(new PassThrough(), {
    isRaw: false,
    setRawMode(mode: boolean) {
      modes.push(mode);
      input.isRaw = mode;
      return input;
    },
  });
  const modes: boolean[] = [];
  const output = new PassThrough();
  let written = "";
  output.on("data", (chunk: Buffer) => (written += String(chunk)));
  const answer = readSecret("Paste the token:", { input, output });
  for (const chunk of chunks) input.write(chunk);
  return {
    answer,
    input,
    modes,
    written: () => written,
    /** How many characters the prompt shows as taken. */
    dots: () => written.split("•").length - 1,
  };
}

describe("reading a secret at the terminal", () => {
  it("takes a paste whole, line break and all, and ends only on Enter typed after it", async () => {
    const r = reading([`${PASTE}sk-ant-oat01-FIRST\rSECOND${END}`, ENTER]);
    expect(await r.answer).toBe("sk-ant-oat01-FIRST\rSECOND");
  });

  it("takes a paste a terminal sent in pieces, markers split between them", async () => {
    const r = reading([
      "\u001b[20",
      "0~sk-ant-oat01-FIRST\nSEC",
      "OND\u001b[2",
      "01~",
      ENTER,
    ]);
    expect(await r.answer).toBe("sk-ant-oat01-FIRST\nSECOND");
  });

  it("takes typed characters up to Enter, and shows a dot for each", async () => {
    const r = reading(["a", "b", "c", ENTER]);
    expect(await r.answer).toBe("abc");
    expect(r.dots()).toBe(3);
    expect(r.written()).not.toContain("abc");
  });

  it("takes what is typed after a paste", async () => {
    const r = reading([`${PASTE}abc${END}`, "d", "e", ENTER]);
    expect(await r.answer).toBe("abcde");
    expect(r.dots()).toBe(5);
  });

  it("removes a character on Backspace, and its dot", async () => {
    const r = reading(["a", "b", "\u007f", "c", "\b", "\b", "\b", "d", ENTER]);
    expect(await r.answer).toBe("d");
    expect(r.written().split("\b \b").length - 1).toBe(3);
  });

  it("ignores a key that is no character, such as an arrow", async () => {
    const r = reading(["a", "\u001b[A", "\u001b[1;5C", "b", "\t", ENTER]);
    expect(await r.answer).toBe("ab");
  });

  it("ends on a line break where the terminal marks no paste, and leaves what follows it unread", async () => {
    const r = reading(["sk-ant-oat01-FIRST\rSECOND\r"]);
    expect(await r.answer).toBe("sk-ant-oat01-FIRST");
    expect(r.input.read()).toBeNull();
  });

  it("stops on Ctrl-C as the other prompts do, by the error's name", async () => {
    const r = reading(["a", "\u0003"]);
    await expect(r.answer).rejects.toMatchObject({ name: "ExitPromptError" });
  });

  it("stops the same way when the terminal closes before Enter", async () => {
    const r = reading(["a"]);
    r.input.end();
    await expect(r.answer).rejects.toMatchObject({ name: "ExitPromptError" });
  });

  it("shows the question, then turns bracketed paste on for the prompt and off after it", async () => {
    const r = reading(["a", ENTER]);
    await r.answer;
    const said = r.written();
    expect(said).toContain("Paste the token:");
    expect(said.indexOf(ON)).toBeGreaterThan(-1);
    expect(said.indexOf(OFF)).toBeGreaterThan(said.indexOf(ON));
    expect(said.endsWith("\n")).toBe(true);
    expect(said.split(ON).length - 1).toBe(1);
  });

  it("turns bracketed paste off, and the terminal's mode back, when it is stopped", async () => {
    const r = reading(["\u0003"]);
    await r.answer.catch(() => {});
    expect(r.written()).toContain(OFF);
    expect(r.modes).toEqual([true, false]);
  });

  it("reads keys as they come, and puts the terminal's mode back as it was", async () => {
    const r = reading(["a", ENTER]);
    await r.answer;
    expect(r.modes).toEqual([true, false]);
    expect(r.input.isPaused()).toBe(true);
  });
});
