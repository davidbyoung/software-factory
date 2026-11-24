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

/** A session in the cloud, confined to what it is given. */
export type CloudSession = {
  prompt: string;
  /** The copy of the branch it changes. */
  work: string;
  /** Where it leaves what it hands over. */
  out: string;
  /** The package manager's cache. */
  cache: string;
  /** Folders no command of its may write. */
  readOnly: string[];
  /** Hosts its commands may reach, besides the package registry. */
  hosts: string[];
  maxTurns: number;
  model?: string;
  /** The shape of its answer, for a session that changes nothing. */
  schema?: object;
};

export type SessionCommand = { command: string; args: string[] };
