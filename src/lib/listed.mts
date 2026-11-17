/** Items as a sentence lists them: "a", "a and b", "a, b, and c". */
export const listed = (items: readonly string[]): string =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
