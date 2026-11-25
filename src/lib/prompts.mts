// The questions a command asks at the terminal, in the looks of
// `lib/output.mts`: an open one's mark says it is the person's turn, and an
// answered one's that it is done.
import { StringDecoder } from "node:string_decoder";
import { colorOn, painted, type Role } from "./output.mts";

/** The questions init asks. Each is answered at the terminal, and in tests
 * from a script. */
export type Ask = {
  checkbox(
    message: string,
    choices: {
      name: string;
      value: string;
      checked: boolean;
      /** Shown under the list while this choice is highlighted. */
      description?: string;
    }[],
  ): Promise<string[]>;
  select(
    message: string,
    choices: { name: string; value: string }[],
    /** The value chosen when the person picks nothing else. */
    fallback?: string,
  ): Promise<string>;
  confirm(message: string, fallback: boolean): Promise<boolean>;
  /** Read without echoing what is typed. */
  secret(message: string): Promise<string>;
  input(message: string, fallback: string): Promise<string>;
};

/** The answer Enter gives to a question, as the question shows it: in
 * words, since parentheses around it read as part of the answer. */
export const defaultInWords = (value: string): string =>
  value ? `Press Enter for ${value}` : "";

/** The prompt library's theme, painted by whether standard output is in
 * color. */
export function promptTheme(color = colorOn(process.stdout)) {
  const as = (role: Role) => (text: string) => painted(role, text, color);
  return {
    prefix: { idle: as("yourTurn")("?"), done: as("good")("✓") },
    style: {
      answer: as("copy"),
      message: as("name"),
      highlight: as("copy"),
      key: as("copy"),
      help: as("skip"),
      description: as("skip"),
      defaultAnswer: (text: string) => as("skip")(`(${text})`),
      keysHelpTip: (keys: [key: string, action: string][]) =>
        as("skip")(keys.map((k) => k.join(" ")).join(" • ")),
      error: (text: string) => as("bad")(`> ${text}`),
    },
  };
}

/** The terminal a secret is read from: its keys, and where the prompt is
 * written. A stream that is no terminal has no mode to set. */
export type SecretIo = {
  input: NodeJS.ReadableStream & {
    isRaw?: boolean;
    setRawMode?(mode: boolean): unknown;
  };
  output: NodeJS.WritableStream & { columns?: number };
};

/** What a terminal sends around pasted text once bracketed paste is on,
 * and what turns that on and off. */
const PASTE_START = "\u001b[200~";
const PASTE_END = "\u001b[201~";
const BRACKETED_ON = "\u001b[?2004h";
const BRACKETED_OFF = "\u001b[?2004l";
/** Keeps where the cursor is, and goes back to it. */
const SAVE = "\u001b7";
const RESTORE = "\u001b8";
/** A whole escape sequence at the start of what is left to read: a key
 * that is no character, or one of the paste's two marks. */
const SEQUENCE = /^\u001b(?:\[[0-9;?]*[@-~]|O[@-~]|[^[O])/;

/** Reads a secret without echoing it, a dot for each character taken. It
 * ends on Enter typed outside a paste: a token copied from two lines of a
 * terminal is pasted with its line break, which a prompt that reads one
 * line takes for Enter, keeping the first line alone. Stopped with Ctrl-C,
 * or by the terminal closing, it rejects as the other prompts do, with an
 * error named `ExitPromptError`. */
export function readSecret(message: string, io: SecretIo): Promise<string> {
  const { input, output } = io;
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    const wasRaw = input.isRaw ?? false;
    let value = "";
    let pending = "";
    let pasting = false;
    let dots = 0;
    const color = colorOn(output);
    /** Puts the answered mark over the question's, which is as many rows up
     * as the question and its dots wrapped to. */
    const answered = () => {
      if (!output.columns) return;
      const up = Math.floor(
        (2 + [...message].length + 1 + dots - 1) / output.columns,
      );
      output.write(
        `${SAVE}${up ? `\u001b[${up}A` : ""}\r${painted("good", "✓", color)}${RESTORE}`,
      );
    };
    const finish = (settle: () => void) => {
      input.off("data", read);
      input.off("end", closed);
      input.off("close", closed);
      input.pause();
      input.setRawMode?.(wasRaw);
      output.write(`${BRACKETED_OFF}\n`);
      settle();
    };
    const stopped = () => {
      const error = new Error("User force closed the prompt");
      error.name = "ExitPromptError";
      return error;
    };
    const closed = () => finish(() => reject(stopped()));
    const take = (text: string) => {
      value += text;
      dots += [...text].length;
      output.write("•".repeat([...text].length));
    };
    /** Takes what `pending` holds, up to a sequence the terminal has not
     * finished sending. True once the prompt has ended. */
    const consume = (): boolean => {
      while (pending) {
        if (pending[0] === "\u001b") {
          const sequence = SEQUENCE.exec(pending)?.[0];
          if (sequence === undefined) return false;
          pending = pending.slice(sequence.length);
          if (sequence === PASTE_START) pasting = true;
          else if (sequence === PASTE_END) pasting = false;
          continue;
        }
        const character = [...pending][0]!;
        pending = pending.slice(character.length);
        if (pasting) take(character);
        else if (character === "\r" || character === "\n") {
          // Anything after the line break was pasted with no marks around
          // it, and would otherwise answer the next question.
          pending = "";
          answered();
          finish(() => resolve(value));
          return true;
        } else if (character === "\u0003") {
          finish(() => reject(stopped()));
          return true;
        } else if (character === "\u007f" || character === "\b") {
          const last = [...value].at(-1);
          if (last !== undefined) {
            value = value.slice(0, -last.length);
            dots--;
            output.write("\b \b");
          }
        } else if (character >= " ") take(character);
      }
      return false;
    };
    const read = (chunk: Buffer | string) => {
      pending += typeof chunk === "string" ? chunk : decoder.write(chunk);
      consume();
    };
    output.write(
      `${painted("yourTurn", "?", color)} ${painted("name", message, color)} ${BRACKETED_ON}`,
    );

    input.setRawMode?.(true);
    input.on("data", read);
    input.once("end", closed);
    input.once("close", closed);
    input.resume();
  });
}

/** The questions, asked at the terminal. */
export async function terminalAsk(): Promise<Ask> {
  const p = await import("@inquirer/prompts");
  const theme = promptTheme();
  return {
    checkbox: (message, choices) => p.checkbox({ message, choices, theme }),
    select: (message, choices, fallback) =>
      p.select({ message, choices, default: fallback, theme }),
    confirm: (message, fallback) =>
      p.confirm({ message, default: fallback, theme }),
    secret: (message) =>
      readSecret(message, { input: process.stdin, output: process.stdout }),
    input: (message, fallback) =>
      p.input({
        message,
        default: fallback,
        theme: {
          ...theme,
          style: {
            ...theme.style,
            defaultAnswer: (text: string) =>
              painted("skip", defaultInWords(text), colorOn()),
          },
        },
      }),
  };
}

/** Asks a question answered by typing: its words bold, the answer plain. */
export async function askTyped(question: string): Promise<string> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(typedQuestion(question, colorOn()));
  } finally {
    rl.close();
  }
}

/** The question as it is drawn, with the spaces around its words plain. */
export const typedQuestion = (question: string, color: boolean): string =>
  question.replace(/\S(?:.*\S)?/s, (words) => painted("name", words, color));
