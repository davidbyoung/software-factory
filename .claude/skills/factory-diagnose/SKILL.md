---
name: factory-diagnose
description: Find the cause of a bug, a failing or flaky test, or a slowdown before changing any code, from one command that fails on the exact symptom. Use when something is broken, failing, flaky, or slow and the cause is not already known.
---

# Diagnosing a bug

Reading code to build a theory before anything fails on demand is the
failure this skill prevents. A theory with no failing command behind it
gets a fix that fixes something else.

## 1. Build the loop

The loop is one command that fails on this bug and passes once it is
fixed. Everything after it only spends it, so spend the effort here.
Reach for the cheapest that gets to the symptom:

1. A unit test at the seam nearest the bug, run alone with
   `npx --no-install factory test-one FILE NAME`. A decision buried where
   no unit test reaches it moves into a plain function first, where the
   area's rules say logic goes ("Rules by area" in `CLAUDE.md`).
2. A script in the scratchpad that imports the module and calls it with
   the failing input.
3. For a script the repository runs, the real invocation on a fixture
   input, its output diffed against a known-good copy.
4. An end-to-end spec, when the symptom needs the whole application
   running, such as in a browser, run alone with
   `npx --no-install factory end-to-end FILE`, and repeated with
   `--times K`. It usually builds the application first, so it is the
   slowest loop.
5. `git bisect run` with any of the above, when the bug arrived between
   two known commits.
6. A CI failure that will not reproduce locally: read the failed job's log
   (`npx --no-install factory pr failed N`), then close the gap between the two
   environments one difference at a time, such as the number of workers,
   a fresh build, and `CI` being set.

Then tighten it: faster (one file, one test, a filtered page), sharper (it
asserts the symptom the report names, not "did not throw"), and steadier
(a fake clock or fake timers, a seeded source of randomness).

**A flaky failure** needs a reproduction rate, not a clean repro. Repeat
it (`npx --no-install factory end-to-end FILE --times 50` for an
end-to-end spec, which stops at the first run that fails and says which,
or the test runner's own repeat option for a unit test),
and add the load CI has, more workers or a second suite at once, until it fails
often enough to tell a fix from luck. A 1-in-100 flake cannot be
debugged; a 1-in-3 can.

**Done when** you can show the command and its output, already run, and
it fails on the symptom the report describes, gives the same verdict
every run (or a pinned rate for a flake), and runs unattended. When no
such command can be built, stop and say what was tried, and ask for what
would make one: a log, a recording, steps, or access.

## 2. Shrink it

Check that it fails on the reported symptom, not on a neighbor. Then cut
the input, the setup, and the steps one at a time, re-running after each
cut, until removing anything else makes it pass. What is left is the
regression test in step 5.

## 3. Rank hypotheses

Write three to five causes before testing any, each with the prediction
that would prove it: "if X is the cause, changing Y makes it pass." One
that predicts nothing is dropped. When the owner is in the session, show
the list before testing it, since they may rule one out at a glance;
otherwise go on.

## 4. Test them, one change at a time

Each probe tests one prediction. Prefer a breakpoint or a REPL to logs;
when logging, tag every line `[DEBUG-xxxx]` with one random tag, so
removing them is one grep. For a slowdown, measure before changing
anything (a timer, the profiler, the test runner's trace), and bisect against
the number.

## 5. Fix it

Turn the shrunk repro into a test at a seam that runs the real path the
bug took. Run it red before the fix, then green after, as the area's rules
for tests say ("Rules by area" in `CLAUDE.md`). When no seam reaches the bug, the test would pass
either way: say so in the pull request rather than ship it, and name the
decision that should move into a plain function.

Then run step 1's loop on the original, unshrunk case.

## 6. Clean up

- the original loop passes
- the regression test failed before the fix and passes after
- `git grep -n 'DEBUG-xxxx'` finds nothing
- scratch scripts stay in the scratchpad, not the repository
- the commit message names the cause the evidence confirmed
