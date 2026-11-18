# Quick start

For someone with a repository and a coding agent who has never used the
factory. At the end you have a pull request built from one of your
tickets. You run a few commands, say how your code is checked, write one
ticket, and answer a question or two. It needs no board, no secrets, and
nothing to host.

A word you do not know is in the [glossary](glossary.md).

## You need

- A repository on a supported code host, cloned on your machine, with the
  code host's command-line tool signed in.
- A supported coding agent, signed in.
- Node 22.18 or later.

[What you need](github/setup.md#what-you-need) names the supported tools
and how to check each. A repository with no `package.json` works too:
[read this first](existing-repo.md#a-repository-that-is-not-javascript).

## 1. Install

Once on your machine, so you can type `factory`:

```bash
npm install -g @davidbyoung/software-factory
```

Then in your repository, which keeps its own version:

```bash
npm install --save-dev @davidbyoung/software-factory
```

**It worked when** `factory`, run in your repository, prints the list of
its commands.

## 2. Set it up

```bash
factory init
```

It shows what it found and asks which optional parts you want. For this
first ticket, uncheck every part. It then lists everything it will do, and
once you tell it to go ahead, writes your settings file,
`.claude/factory.yaml`, and the instructions and checks your coding agent
follows. It commits nothing. [What it changes](removing.md) lists every
file.

**It worked when** the checks `init` prints last all show ✓, or `-` for a
part you left off. `factory doctor` runs them again at any time.

**Then say how a change is checked.** `init` ends with a list headed "Left
to do", and one line of it comes before your first build:

```text
Add the commands that check a change, under commands.gate in .claude/factory.yaml
```

A build runs these commands, in order, before it opens its pull request,
and cannot finish without them. Add
[`commands.gate`](configuration.md#commandsgate) to
`.claude/factory.yaml`, with your own test and lint commands in place of
these:

```yaml
commands:
  # What a build runs to check its change, in order.
  gate:
    - npm test
    - npm run lint
```

A repository with no tests yet lists the checks it does have, such as a
formatter or a compile, and adds its tests to the gate when there are
some.

**It worked when** `factory gate` runs each command and ends without a
line that starts `gate failed on`.

## 3. Merge the setup

Commit what `init` wrote on a branch and push it:

```bash
git switch -c set-up-factory
git add -A
git commit -m "Set up the software factory"
git push -u origin set-up-factory
```

Open a pull request for the branch on your code host and merge it, as for
any change. Then bring your default branch up to date. Here it is called
`main`:

```bash
git switch main
git pull
```

Start a new session of your coding agent, which loads the factory from the
files now in your repository.

**It worked when** the new session, asked which skills it has, lists
`factory-refine` and `factory-build`.

## 4. Open a ticket

Open a ticket in your ticket system: on GitHub, an issue in your
repository. Say three things: what you want, why, and how you will know it
is done. A few sentences is enough.

```text
Title: Show the opening hours in the footer

The hours are only on the contact page, and people ask for them.
Done when: every page's footer shows the same hours the contact page does.
```

**It worked when** the ticket has a number. This page uses 12.

## 5. Refine it

In the session, say:

```text
refine ticket 12
```

The session reads the ticket and the code it touches, then asks you the
decisions that are yours, each as a choice with its recommendation first:

```text
Where should the hours come from?
  1. The settings file the contact page already reads (Recommended)
  2. A new footer-only setting
```

**It worked when** the ticket ends with acceptance criteria, a checklist
of exactly what "done" means, and the session says it is ready to build.

## 6. Build it

In the same session, or a new one:

```text
build ticket 12
```

Telling a session to build a ticket is how you approve it. The session
makes a branch, writes a test and then the change, and opens a pull
request that closes the ticket. Expect minutes, not seconds.
[Workflow](workflow.md#from-a-ticket-to-a-merge) has each step.

**It worked when** its last message names the pull request, says what it
built, and says how it checked it. This page uses 15 for the pull
request's number.

## 7. Read it and merge

Open the pull request. Its description says what changed, how it was
verified, and anything the session noticed and left alone. Nothing merges
without you.

To ask for changes, comment on the pull request, then tell a session to
answer your comments:

```text
address the review on pull request 15
```

**It worked when** the pull request is merged and ticket 12 is closed.
That is the whole loop: **ticket, refine, build, read, merge.**

## If something goes wrong

| What happened                                  | What to do                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A test or a check fails during the build       | Nothing. The session sees the output, fixes the cause, and tries again                      |
| The session stops and says it needs you        | It says why, in the session and on the ticket. Answer, then ask it to build ticket 12 again |
| The build stops on `commands.gate is not set`  | Add your test and lint commands, as in step 2, then ask it to build ticket 12 again         |
| The session was closed or crashed partway      | Ask a new session to build ticket 12. It picks up the branch it made                        |
| You want to change what was decided            | Ask a session to refine ticket 12 again, or edit the ticket                                 |
| CI fails on the pull request                   | Ask a session to address the review on pull request 15. It reads the failure and fixes it   |
| The session does not know the factory's skills | The setup is not merged, or the session started before it was. See step 3                   |
| Anything else                                  | Run `factory doctor`. It says what is wrong, and what to do about it                        |

## What to add next

Everything above runs on your machine while you watch. Each of these is
optional, stands alone, and can come later.

- **An automated review, a board, builds in the cloud, builds that start
  from the board, and pull requests that merge themselves.** Run
  `factory init` again and check the parts you want. It asks for a token
  or two and sets everything else up.
  [Setting up on GitHub](github/setup.md#run-factory-init) says what each
  part gives you and what it asks.
- **A command before every commit a session makes,** such as your linter:
  a few lines under
  [`commands.before-commit`](configuration.md#commandsbefore-commit).
- **Your own reviewers,** so a change to your content or your design is
  read by an expert agent: a few lines under
  [`plugins`](configuration.md#plugins), which [Plugins](plugins.md)
  walks through.
