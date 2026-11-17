# Quick start

From nothing to a pull request built from one of your tickets. You run a
few commands, write one ticket, and answer a question or two; your coding
agent does the rest. This page needs no board, no secrets, and nothing to
host.

A word you do not know is in the [glossary](glossary.md).

## You need

- A repository on a supported code host, cloned on your machine, with the
  code host's command-line tool signed in.
- A supported coding agent, signed in.
- Node 22.18 or later. Check with `node --version`.

Which tools are supported, and how to check each is ready, is in
[What you need](github/setup.md#what-you-need) on the GitHub page.

Your repository does not have to be JavaScript. If it is not, read
[this section](existing-repo.md#a-repository-that-is-not-javascript)
first: installing adds a small `package.json`.

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
its commands. It exits non-zero, since no command was given; that is
expected.

## 2. Set it up

```bash
factory init
```

It says what it found, asks which optional parts you want, and shows
everything it will do before it does any of it. For this first ticket,
uncheck every part: the basics need none.

Told to go ahead, it writes your settings file, `.claude/factory.yaml`,
and the instructions your coding agent follows when it works a ticket. It
adds hooks: small checks your agent runs on its own, such as refusing a
commit on your main branch. It adds one line to your agent's instructions
file, such as `CLAUDE.md`, and the hooks to your agent's settings,
creating either file if you have none. It changes nothing else of yours,
and commits nothing. [What it changes](removing.md) lists every item and
how to undo it.

**It worked when** the checks it prints last all show ✓. Run them again at
any time with `factory doctor`.

**To do it by hand instead,** write the shortest settings file, with your
repository's owner and name, then write the factory's files:

```yaml
version: 1
repository: your-name/your-repo
```

```bash
factory sync
```

A build checks its change with the commands your agent's instructions
file names, such as your tests and your linter, so say there how to check
a change. Without any, it checks with the tests it wrote.

To have a command run before every commit a session makes, such as your
linter, list it under `before-commit` in the settings file:

```yaml
before-commit:
  - npm run lint
```

## 3. Merge the setup

Commit what `sync` wrote on a branch, push it, then open a pull request for
it on your code host, as for any change, and merge it:

```bash
git switch -c set-up-factory
git add -A
git commit -m "Set up the software factory"
git push -u origin set-up-factory
```

Then bring your main branch up to date:

```bash
git switch main
git pull
```

Your coding agent loads the factory from the files in your repository, so
start a new session after this step.

**It worked when** the new session, asked which skills it has, lists
`factory-refine` and `factory-build`. A skill is a set of instructions for
one kind of job, such as refining a ticket.

## 4. Open a ticket

A ticket in your ticket system. Say three things: what you want, why, and
how you will know it is done. A few sentences is enough.

```text
Title: Show the opening hours in the footer

The hours are only on the contact page, and people ask for them.
Done when: every page's footer shows the same hours the contact page does.
```

Note its number. This page uses 12.

## 5. Refine it

In a session of your coding agent, in your repository, say:

```text
refine ticket 12
```

The session reads the ticket and the code it touches. Then it asks you the
decisions that are yours, each as a choice with its recommendation first:

```text
Where should the hours come from?
  1. The settings file the contact page already reads (Recommended)
  2. A new footer-only setting
```

**It worked when** the ticket ends with acceptance criteria, a checklist
that says exactly what "done" means, and the session says it is ready to
build.

## 6. Build it

In the same session, or a new one:

```text
build ticket 12
```

Telling a session to build a ticket is how you approve it.

You can watch it work. The session:

1. comments on the ticket that it has claimed it, so no other session
   builds the same one;
2. makes a branch;
3. writes a test, then the change;
4. checks each commit with your `before-commit` commands, if you set any;
5. opens a pull request that closes the ticket, as a draft, which tells
   people and the automated review it is not finished;
6. marks it ready for review once your CI passes on it, or after two
   minutes when no CI runs on it, and answers any review it gets.

**It worked when** its last message names the pull request, says what it
built, and says how it checked it. Expect minutes, not seconds.

## 7. Read it and merge

Open the pull request. Its description says what changed, how it was
verified, and anything the session noticed and left alone. Nothing merges
without you.

To ask for changes, comment on the pull request, then tell a session to
answer your comments:

```text
address the review on pull request 15
```

That is the whole loop: **ticket, refine, build, read, merge.**

## If something goes wrong

| What happened                                    | What to do                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| A `before-commit` command fails during the build | Nothing. The session sees the output, fixes the cause, and tries again                      |
| The session stops and says it needs you          | It says why, in the session and on the ticket. Answer, then ask it to build ticket 12 again |
| The session was closed or crashed partway        | Ask a new session to build ticket 12. It picks up the branch it made                        |
| You want to change what was decided              | Ask a session to refine ticket 12 again, or edit the ticket                                 |
| CI fails on the pull request                     | Ask a session to address the review on pull request 15. It reads the failure and fixes it   |
| The session does not know the factory's skills   | The setup is not merged, or the session started before it was. See step 3                   |
| Anything else                                    | Run `factory doctor`. It says what is wrong, and what to do about it                        |

## What to add next

Everything above runs on your machine while you watch. Each part below is
optional, stands alone, and can come later.

| Add                                 | So that                                                              | It asks of you                                |
| ----------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| An automated review                 | Every pull request is read by your coding agent before you read it   | Your agent's token, stored on the code host   |
| A board                             | You see every ticket's state, which session has it, and what it cost | A board, and a token that can write to it     |
| Builds in the cloud                 | A ticket builds with no session open on your machine                 | Your agent's token, and a token that can push |
| Builds that start from the board    | Moving a ticket to Ready builds it                                   | A small program, the poller, that you host    |
| Pull requests that merge themselves | Changes to files you list as safe do not wait for you                | The list of files, and a token that can merge |
| Your own reviewers                  | A change to your content or your design is read by an expert agent   | A few lines of settings                       |

Run `factory init` again and turn on the parts you want;
it sets up each one, tokens included. [Setting up on GitHub](github/setup.md)
has the same steps by hand, on one page.
