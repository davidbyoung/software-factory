# Quick start

For someone with a repository and a coding agent who has never used kodor. At the end you have a pull request built from one of your
tickets. You run a few commands, answer the questions `kodor init`
asks as it sets your repository up, which step 2 lists, write one
ticket, and settle the decisions your coding agent asks you about it. It
needs no board, no secrets, and nothing to host.

**If your repository belongs to an organization,** nothing on this page
changes. Before you turn on a feature that runs in the cloud, ask an owner
whether the organization is set up:
[Which setup is yours](../setup/README.md) says why.

A word you do not know is in the [glossary](../reference/glossary.md).

## You need

- A repository on a supported code host, cloned on your machine, with the
  code host's command-line tool signed in. It can be new and empty:
  `kodor init` then offers to push a first commit.
- A supported coding agent, signed in. `kodor init` stops without one.
- Node 22.18 or later.

Today the code host is [GitHub](../integrations/github.md) and the
coding agent is [Claude Code](../integrations/claude-code.md), and
[What you need](../setup/repository.md#what-you-need) says how to check each.
Your repository can be written in any language:
[A repository that is not JavaScript](../customize/any-language.md#a-repository-that-is-not-javascript)
says what that takes.

## 1. Install

Once on your machine, for every repository you use it in:

```bash
npm install -g @kodor-ai/kodor
```

Nothing is installed in your repository, unless you choose a spec tool
that npm installs in step 2 ([`specs`](../reference/settings/specs.md#specs) says
what). Once it is set up, it names the
version of kodor it uses, and `kodor` runs that version there
([Updating](../maintain/updating.md#what-happens)).

**It worked when** `kodor`, run in your repository, prints the list of
its commands.

## 2. Set it up

On your default branch, in your repository:

```bash
kodor init
```

It shows what it found, then asks two things first: how a build names
its branch, and which spec tool you use. If you are unsure, press Enter
for the first and choose None for the second.

Next it asks which optional parts you want. Three start checked: "An
automated review of every pull request", "A board", and "Builds in the
cloud". For this first ticket, uncheck those three:
each needs a token or a secret you set up later, and this page needs
none. Keep them checked instead if you want the full setup now. If
your repository belongs to an organization, and one of its owners has
already run kodor's setup for the whole organization, init asks
less, and for no token:
[In an organization](../setup/repository.md#in-an-organization) shows what you
see.

Then it asks how a change is checked:

```text
? Which command checks a change here, such as npm test? (leave empty to add it later)
```

Type the command that tests your project. A build runs it before it
opens its pull request, and cannot finish without one. Init saves it in
your settings file, `.claude/kodor.yaml`, under
[`commands.gate`](../reference/settings/commands.md#commandsgate). To have a build run
more than one command, in order, add the others there afterward, with
your own in place of these:

```yaml
commands:
  # What a build runs to check its change, in order.
  gate:
    - npm test
    - npm run lint
```

A repository with no tests yet gives a check it does have, such as a
formatter or a compile, and adds its tests to the gate when there are
some.

Last, it lists everything it will do and asks "Go ahead?". Type `y`:
Enter alone answers no, and nothing changes. It then writes your
settings file and the instructions and checks your coding agent follows,
runs the command you gave, commits what it wrote on a new branch,
`set-up-kodor`, pushes it, and opens a pull request:

```text
✓ npm test passes here.
✓ Opened your-name/your-repo#1, "Set up kodor".
Merge it to finish. Nothing else is left to do.
```

When the command fails, init says so and commits nothing. Fix what
failed, or change the command in `.claude/kodor.yaml`, and run
`kodor init` again. On a public repository init also adds a policy
that lets kodor's workflow run, which needs admin rights on the
repository ([A public repository](../integrations/github.md#a-public-repository)).
[What it changes](../maintain/removing.md) lists every file.

**It worked when** init prints `✓ Opened` with the pull request's
number, and the checks it prints last all show ✓, or `-` for a part you
left off. `kodor doctor` runs them again at any time, and
`kodor gate` runs your command, ending with
`✓ Every gate command passed.`

## 3. Merge the setup

Merge the pull request `init` opened, as for any change. Under the
pull request's line, `init` printed what comes next:

```text
After it merges:
  1. Come back to main and bring it up to date:
       git switch main && git pull
  2. Start a new session of your coding agent here. It loads kodor from the files now in your repository.
  3. Refine a ticket with /kodor-refine N, then build it with /kodor-build N.
```

Do the first two now. Your checkout is left on the branch
`set-up-kodor`, and the first step names your own default branch. The
third is steps 5 and 6 of this page, once you have a ticket.

**It worked when** typing `/kodor` in the new session lists
`kodor-refine` and `kodor-build`.

## 4. Open a ticket

Open a ticket in your ticket system: on
[GitHub Issues](../integrations/github-issues.md), an issue in your
repository. Say three things: what you want, why, and how you will know it
is done. A few sentences is enough.

```text
Title: Show the opening hours in the footer

The hours are only on the contact page, and people ask for them.
Done when: every page's footer shows the same hours the contact page does.
```

**It worked when** the ticket has a number. This page uses 12.

## 5. Refine it

In the session, type:

```text
/kodor-refine 12
```

That runs the `kodor-refine` skill on ticket 12.
[Skills and agents](../reference/skills.md#at-a-glance) lists the other commands.

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
/kodor-build 12
```

Running `kodor-build` on a ticket is how you approve it. The session
makes a branch, writes a test and then the change, and opens a pull
request that closes the ticket. Expect minutes, not seconds.
[The workflow](../workflow/README.md#from-a-ticket-to-a-merge) has each step.

**It worked when** its last message names the pull request, says what it
built, and says how it checked it. This page uses 15 for the pull
request's number.

## 7. Read it and merge

Open the pull request. Its description says what changed, how it was
verified, and what the session [noticed and did not fix](../workflow/follow-ups.md). Nothing merges
without you.

To ask for changes, comment on the pull request, then have a session
answer your comments:

```text
/kodor-address-review 15
```

**It worked when** the pull request is merged and ticket 12 is closed.
That is the whole loop: **ticket, refine, build, read, merge.**

If something goes wrong, [Troubleshooting](../maintain/troubleshooting.md)
says what to do.

## What to add next

Everything above runs on your machine while you watch. Each of these is
optional, stands alone, and can come later.

- **An automated review, a board, builds in the cloud, builds that start
  from the board, and pull requests that merge themselves.** Run
  `kodor init` again and check the parts you want. It asks for a token
  or two, sets everything else up, and opens a pull request titled
  "Change kodor's settings" with the files it changed,
  and says how to bring your default branch up to date once it merges. In
  an organization whose owner has run kodor's setup for it, init
  asks for no token.
  [Set up a repository](../setup/repository.md#run-kodor-init) says what each
  part gives you and what it asks.
- **A command before every commit a session makes,** such as your linter:
  a few lines under
  [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit).
- **Your own reviewers,** so a change to your content or your design is
  read by an expert agent: a few lines under
  [`plugins`](../reference/settings/plugins.md#plugins), which [Your own skills and agents](../customize/plugins.md)
  walks through.
