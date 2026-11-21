/** Items as a sentence lists them: "a", "a and b", "a, b, and c", or
 * with "or" in place of "and". */
export const listed = (
  items: readonly string[],
  conjunction: "and" | "or" = "and",
): string =>
  items.length < 3
    ? items.join(` ${conjunction} `)
    : `${items.slice(0, -1).join(", ")}, ${conjunction} ${items.at(-1)}`;
