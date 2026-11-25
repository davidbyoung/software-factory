// Why a call failed, as a line of output says it.

export const message = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

/** Why a read failed, in the code host's words: without the command its
 * own tool names before them. */
export const reasonOf = (e: unknown) =>
  message(e).replace(/^gh [^\n]*?: gh: /, "");
