---
name: factory-mutate
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

One mutation per behavior, except where "Small changes" in `.claude/factory/rules.md`
says otherwise. A mutation that leaves the code
not compiling proves nothing; choose another.

## 2. Run them

Each one copies the file aside, applies the edit, runs only the relevant test
file, and restores the original whatever happens. Put the script in the
scratchpad, not the repo:

```python
import shutil, subprocess

MUTATIONS = [
    # (source file, exact text, replacement, test file)
    ("lib/x.ts", "if (a && b)", "if (a)", "tests/x.test.ts"),
]
for path, old, new, test in MUTATIONS:
    original = open(path).read()
    assert original.count(old) == 1, (path, old)
    try:
        open(path, "w").write(original.replace(old, new))
        failed = subprocess.run(["npx", "vitest", "run", test],
                                capture_output=True).returncode != 0
    finally:
        open(path, "w").write(original)
    print("RED  " if failed else "GREEN", path, old)
```

Use the project's own test command. For a coverage-instrumented runner,
disable coverage for speed. For Playwright, rebuild before each run if the
tests run against a build. Not `next dev`: it rewrites `AGENTS.md`, and a
test can time out there with nothing broken, which reads as red.

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
