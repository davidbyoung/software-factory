// The issue forms GitHub offers when a ticket is opened. A form GitHub cannot
// read falls back to a blank issue without a word, so each one is checked
// for the keys GitHub requires.
import { readdirSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const DIR = new URL("../.github/ISSUE_TEMPLATE/", import.meta.url);
const forms = readdirSync(DIR).filter(
  (f) => f.endsWith(".yml") && f !== "config.yml",
);

describe("the issue forms", () => {
  it("are the bug and change forms", () => {
    expect(forms.sort()).toEqual(["bug.yml", "change.yml"]);
  });

  it.each(forms)("%s has a name, a description, and fields with ids", (f) => {
    const form = load(readFileSync(new URL(f, DIR), "utf8")) as {
      name?: string;
      description?: string;
      body?: { id?: string; type?: string }[];
    };
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    expect(form.body?.length).toBeGreaterThan(0);
    expect(form.body!.every((field) => field.id && field.type)).toBe(true);
  });
});
