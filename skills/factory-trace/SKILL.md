---
name: factory-trace
description: Trace a change to the process through every kind of change the repository gets, with one fresh agent, and report each kind that got heavier, lighter, or ambiguous and any two rules that now disagree. Use before a pull request is marked ready when it changes the rules, a skill, an agent, or a workflow in a way that alters what triggers a step, who runs, or when, and when asked to trace a rule change. A change of wording alone needs no trace.
---

# Tracing a change to the process

A rule written for the change in front of its author can be wrong for
every other kind. Once, the step that adds the `spec` label kept adding it
to small changes after the table that defines the label stopped. This skill
has a reader who did not write the change walk each kind of change through
the rules as the branch leaves them, before the pull request is marked
ready.

## 1. Read the kinds of change

The kinds are in `.claude/change-types.md`, one row each with a real
example.

**When the file is missing,** start no agent. The pull request is not
marked ready untraced: leave it a draft, say on it that the trace needs
the file, and show its shape there, for the owner to write:

```markdown
# Change types

| Kind                                               | Example                                  |
| -------------------------------------------------- | ---------------------------------------- |
| A small bug fix with no change to what a user sees | the guard passing an empty settings file |
| Docs only                                          | the quick start's install line           |
```

Each kind names a change the repository really gets, and each example is
one that happened. The file lists kinds and nothing more: each kind's
path is read from the rules, so the file never restates them.

## 2. Start one fresh agent

The branch is the current one, and its base is the default branch on
`origin`, whose name `factory default-branch` prints,
unless the pull request says otherwise. Start one
`general-purpose` agent, and give it only this:

> The branch BRANCH changes this repository's process: its rules, skills,
> agents, or workflows. Read what it changes with
> `git diff BASE...BRANCH`, then read the rules, skills, and agents as the
> branch leaves them, starting from `CLAUDE.md` and what it imports.
>
> For each kind of change in `.claude/change-types.md`, trace that kind's
> example through the process as it now stands, from the ticket to the
> merge: which steps it takes, which reviewers read it, and who merges it.
> Then do the same on BASE, and compare.
>
> Report one line per kind: **unchanged**, **heavier** (a step, reviewer,
> or wait it did not have), **lighter** (one it lost), or **ambiguous**
> (two readings of the rules give different paths). For every kind that is
> not unchanged, name the rule, by its file and section, that makes it so.
> Then list any two rules that now disagree, quoting both. Where the
> repository's `CLAUDE.md` asks more of this trace, do that too. Read
> only; change nothing.

Give it nothing else from this session: what the author meant is what the
trace tests.

## 3. Report

The agent's report is the result, unedited.

**When the branch has an open pull request,** which
`factory pr state` names on its first line, post the
report there, so the owner reads it before merging:

```bash
factory pr comment N --body-file trace.md
```

Otherwise give it in the session.

Then fix what holds up, and say in the pull request which findings were
fixed and why any were not. A change of wording alone needs no trace.
