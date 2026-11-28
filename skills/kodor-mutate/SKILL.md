---
name: kodor-mutate
description: Prove a test can fail by breaking the code under test one way at a time and watching the test go red. Use for a new or changed test written after the code, or never seen failing on its own symptom, and when asked whether a test locks anything in.
---

# Checking that a test can fail

A test that passes whether or not the fix is there has locked nothing in.
This has shipped more than once. The check is to break the code and watch
the test go red.

## 1. Pick the mutations

For each behavior the new tests claim to cover, write the smallest edit to
the **source** (never the test) that removes that behavior:

- delete the line that does it
- invert or drop a condition: `a && b` to `a`, `>` to `>=`
- return a constant: `return true`, `return []`, `return null`
- skip a call: `cleanup()`, `setState(x)`, `focus()`

One mutation per behavior, except where "Small changes" in `.claude/kodor/rules.md`
says otherwise. A mutation that leaves the code
not compiling proves nothing; choose another.

## 2. Run them

Each one keeps the file's text, applies the edit, runs only the relevant test
file, and restores the original whatever happens. Put the script in the
scratchpad, not the repo, as `mutate.mjs`, and run it with `node` from the
repository's root:

```js
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MUTATIONS = [
  // [source file, exact text, replacement, test file]
  ["lib/x.ts", "if (a && b)", "if (a)", "tests/x.test.ts"],
];
for (const [path, old, replacement, test] of MUTATIONS) {
  const original = readFileSync(path, "utf8");
  if (original.split(old).length !== 2)
    throw new Error(`${path}: not exactly once: ${old}`);
  let failed;
  try {
    // A function, so a "$" in the replacement is not read as a pattern.
    writeFileSync(
      path,
      original.replace(old, () => replacement),
    );
    const run = spawnSync("npx", ["--no-install", "kodor", "test-one", test], {
      stdio: "ignore",
    });
    failed = run.status !== 0;
  } finally {
    writeFileSync(path, original);
  }
  console.log(failed ? "RED  " : "GREEN", path, old);
}
```

`kodor test-one` runs the settings' own command for one test file,
`commands.test-one`, the one for the file's folder where it lists several. For a coverage-instrumented runner, disable coverage
for speed. For an end-to-end spec, run `kodor end-to-end` in its place,
and rebuild before each run if the tests run against a build.

## 3. Confirm the tree is clean

```bash
git status --short
git diff --stat
```

Only the changes that were there before should show. If a source file is
still modified, restore it before doing anything else.

## 4. Act on the result

- **RED** for every mutation: report it in one line.
- **GREEN**: the test did not notice the behavior break. Either the test
  asserts something else, the behavior is covered only by a slower suite, or
  the test environment cannot reproduce the condition. Fix the test, or, when
  the environment is the limit, move the decision into a plain function a
  unit test can reach and test it there. Say which.

Never weaken a mutation to get a RED. If the honest mutation stays green, the
test is what needs work.
