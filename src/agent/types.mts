// What a coding agent does for `init` beyond the sessions it runs: answer
// one question, with no tools, in the shape a JSON schema gives.

export type Question = {
  prompt: string;
  /** The JSON schema the answer follows. */
  schema: object;
  timeoutMs: number;
};

export type Answer =
  | { answer: unknown }
  /** The command exited non-zero: the first line of its error output, or
   * null when it printed none. */
  | { failed: { code: number; error: string | null } }
  | { timedOut: true };

export type Agent = {
  /** Whether its command is on this machine. */
  installed(hasCommand: (name: string) => boolean): boolean;
  answer(q: Question): Promise<Answer>;
};
