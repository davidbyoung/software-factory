import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bareTags, issueBodies, refusal } from "../src/guard-ticket-text.mts";

const fixture = (name: string) =>
  readFileSync(
    new URL(`./fixtures/issue-text/${name}`, import.meta.url),
    "utf8",
  );

describe("bareTags", () => {
  it("finds a placeholder outside backticks, with its line", () => {
    expect(bareTags("one\n- [ ] /study/guides/<slug>/ opens")).toEqual([
      { tag: "<slug>", line: "- [ ] /study/guides/<slug>/ opens" },
    ]);
  });

  it("passes tags in code spans, code fences, and HTML comments", () => {
    const text = [
      "The `/study/guides/<slug>/` page reads `<code>`.",
      "``a `<N>` b``",
      "```",
      "<author> wrote this",
      "```",
      "<!-- work-status: claim <session> -->",
    ].join("\n");
    expect(bareTags(text)).toEqual([]);
  });

  it("passes a tag on any line of a fenced block, not only its first", () => {
    const text = ["```text", "one", "two", "<your text>", "```"].join("\n");
    expect(bareTags(text)).toEqual([]);
  });

  it("closes a fence only with one of its own character at least as long", () => {
    const text = ["````md", "```", "<inside>", "```", "````", "<outside>"].join(
      "\n",
    );
    expect(bareTags(text).map((t) => t.tag)).toEqual(["<outside>"]);
    const tilde = ["```md", "~~~", "<inside>", "```", "<outside>"].join("\n");
    expect(bareTags(tilde).map((t) => t.tag)).toEqual(["<outside>"]);
  });

  it("passes the tags GitHub renders on purpose, open and closed", () => {
    const text =
      "<details><summary>More</summary>a<br>H<sub>2</sub>O x<sup>2</sup> <kbd>Esc</kbd></details>";
    expect(bareTags(text)).toEqual([]);
  });

  it("refuses <code>, whose unclosed form swallows the rest of a list", () => {
    expect(bareTags("Questions on <code> above").map((t) => t.tag)).toEqual([
      "<code>",
    ]);
  });

  // The fixture is a follow-ups checklist whose placeholders were never
  // backticked; its second line holds the bare <code>.
  it("refuses a follow-ups body with bare placeholders and names <code>", () => {
    const tags = bareTags(fixture("follow-ups-bare-tags.md")).map((t) => t.tag);
    expect(tags).toContain("<code>");
    expect(tags).toContain("<slug>");
  });
});

describe("issueBodies", () => {
  const read = (path: string) => (path === "body.md" ? "see <slug>" : null);

  it("reads --body and -b from gh issue create, edit, and comment", () => {
    expect(
      issueBodies('gh issue create --title T --body "a <slug> b"', read),
    ).toEqual(["a <slug> b"]);
    expect(issueBodies("gh issue edit 5 -b 'x <N>'", read)).toEqual(["x <N>"]);
    expect(issueBodies('gh issue comment 5 --body="y <author>"', read)).toEqual(
      ["y <author>"],
    );
  });

  it("reads --body-file and -F from the file", () => {
    expect(issueBodies("gh issue comment 5 --body-file body.md", read)).toEqual(
      ["see <slug>"],
    );
    expect(issueBodies("gh issue create -t T -F body.md", read)).toEqual([
      "see <slug>",
    ]);
  });

  it("reads a body passed through a heredoc", () => {
    const cmd = `gh issue comment 5 --body "$(cat <<'EOF'\nline <slug>\nEOF\n)"`;
    expect(issueBodies(cmd, read)).toEqual(["line <slug>\n"]);
  });

  it("reads nothing from other commands", () => {
    expect(issueBodies('gh pr comment 5 --body "a <slug>"', read)).toEqual([]);
    expect(issueBodies('echo "gh issue comment --body <slug>"', read)).toEqual(
      [],
    );
    expect(issueBodies("gh issue view 5", read)).toEqual([]);
  });
});

describe("issueBodies on gh api", () => {
  const read = (path: string) => (path === "body.md" ? "see <slug>" : null);
  const api = (args: string) =>
    issueBodies(`gh api -X POST repos/acme/widgets/${args}`, read);

  it("reads -f body=TEXT", () => {
    expect(api("issues/5/comments -f body='a <slug>'")).toEqual(["a <slug>"]);
  });

  it("reads -F body=TEXT", () => {
    expect(api("issues -f title=T -F body='b <N>'")).toEqual(["b <N>"]);
  });

  it("reads -F body=@FILE from the file", () => {
    expect(api("issues/5/comments -F body=@body.md")).toEqual(["see <slug>"]);
  });

  it("reads --raw-field body=TEXT", () => {
    expect(api("issues/5 --raw-field body='c <slug>'")).toEqual(["c <slug>"]);
  });

  it("reads --field body=@FILE from the file", () => {
    expect(api("issues/comments/99 --field body=@body.md")).toEqual([
      "see <slug>",
    ]);
  });

  it("reads -f body=@FILE as the text it is, as gh sends it", () => {
    expect(api("issues/5/comments -f body=@body.md")).toEqual(["@body.md"]);
  });

  it("reads --field=body=@FILE and --raw-field=body=TEXT", () => {
    expect(api("issues/5/comments --field=body=@body.md")).toEqual([
      "see <slug>",
    ]);
    expect(api("issues/5/comments --raw-field=body='d <N>'")).toEqual([
      "d <N>",
    ]);
  });

  it("reads a body sent with the path after the fields", () => {
    expect(
      issueBodies(
        "gh api -F body=@body.md repos/acme/widgets/issues/5/comments",
        read,
      ),
    ).toEqual(["see <slug>"]);
  });

  it("passes a call with no body field unread", () => {
    expect(api("issues/5 -f state=closed")).toEqual([]);
  });

  it("does not read a body sent to a path that is not an issue or comment", () => {
    expect(api("pulls -F body=@body.md")).toEqual([]);
    expect(api("issues/5/labels -f body='a <slug>'")).toEqual([]);
  });
});

describe("refusal", () => {
  it("names each offending line, and says to backtick it", () => {
    const message = refusal([
      { tag: "<code>", line: "Questions on <code> above" },
    ]);
    expect(message).toContain("<code>");
    expect(message).toContain("Questions on <code> above");
    expect(message).toMatch(/backticks/);
  });
});
