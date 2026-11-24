// The PreToolUse hook for Bash: `factory guard` runs every guard on one
// reading of the hook's input, and `factory guard commit`,
// `factory guard ticket-text`, or `factory guard credentials` runs one. A
// block exits 2 with the reason on standard error, which stops the call
// and shows the reason to Claude.
import { readFileSync } from "node:fs";
import { checkCommit, type HookInput } from "./guard-commit.mts";
import { checkCredentials } from "./guard-credentials.mts";
import { checkTicketText } from "./guard-ticket-text.mts";
import * as say from "./lib/output.mts";

export type Which = "all" | "commit" | "ticket-text" | "credentials";

export async function guard(
  which: Which,
  input: HookInput,
  err: (text: string) => void,
): Promise<number> {
  if (which === "all" || which === "credentials") {
    const refusal = checkCredentials(input);
    if (refusal) {
      err(refusal);
      return 2;
    }
    if (which === "credentials") return 0;
  }
  if (which !== "ticket-text") {
    const block = await checkCommit(input, err);
    if (block) {
      err(`Blocked by factory guard commit: ${block}`);
      return 2;
    }
  }
  if (which !== "commit") {
    const refusal = checkTicketText(input);
    if (refusal) {
      err(refusal);
      return 2;
    }
  }
  return 0;
}

export async function run(which: Which): Promise<number> {
  let input: HookInput = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}") as HookInput;
  } catch {
    // No input: nothing to check.
  }
  return guard(which, input, (text) => {
    if (text) say.plainError(text);
  });
}
