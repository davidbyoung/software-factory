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
- A supported coding agent, signed in. `factory init` stops without one.
- Node 22.18 or later.

[What you need](github/setup.md#what-you-need) names the supported tools
and how to check each. Your repository can be written in any language:
[A repository that is not JavaScript](existing-repo.md#a-repository-that-is-not-javascript)
says what that takes.

## 1. Install

Once on your machine, for every repository you use it in:

```bash
npm install -g @davidbyoung/software-factory
```

Nothing is installed in your repository, unless you choose a spec tool
that npm installs in step 2 ([`specs`](configuration.md#specs) says
what). Once it is set up, it names the
version of the factory it uses, and `factory` runs that version there
([Updating](updating.md#what-happens)).

**It worked when** `factory`, run in your repository, prints the list of
its commands.

## 2. Set it up

On your default branch, in your repository:

```bash
factory init
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
already run the factory's setup for the whole organization, init asks
less, and for no token:
[In an organization](github/setup.md#in-an-organization) shows what you
see.

Then it asks how a change is checked:

```text
? Which command checks a change here, such as npm test? (leave empty to add it later)
```

Type the command that tests your project. A build runs it before it
opens its pull request, and cannot finish without one. Init saves it in
your settings file, `.claude/factory.yaml`, under
[`commands.gate`](configuration.md#commandsgate). To have a build run
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
`set-up-factory`, pushes it, and opens a pull request:

```text
✓ npm test passes here.
✓ Opened your-name/your-repo#1, "Set up the software factory".
Merge it to finish. Nothing else is left to do.

After it merges:
  1. Come back to main and bring it up to date:
       git switch main && git pull
  2. Start a new session of your coding agent here. It loads the factory from the files now in your repository.
  3. Refine a ticket with /factory-refine N, then build it with /factory-build N.
```

Under those lines it prints the address of step 4 of this page, at the
version you installed.

When the command fails, init says so and commits nothing. Fix what
failed, or change the command in `.claude/factory.yaml`, and run
`factory init` again. On a public repository init also adds a policy
that lets the factory's workflow run, which needs admin rights on the
repository ([A public repository](github/setup.md#a-public-repository)).
[What it changes](removing.md) lists every file.

**It worked when** init prints `✓ Opened` with the pull request's
number, and the checks it prints last all show ✓, or `-` for a part you
left off. `factory doctor` runs them again at any time, and
`factory gate` runs your command, ending with
`✓ Every gate command passed.`

## 3. Merge the setup

Merge the pull request `init` opened, as for any change. Then do the
first two steps `init` printed under "After it merges:". Your checkout
is left on the branch `set-up-factory`, so the first brings you back to
your default branch, which it names, and up to date. The second starts a
new session of your coding agent, which loads the factory from the files
now in your repository.

**It worked when** typing `/factory` in the new session lists
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

In the session, type:

```text
/factory-refine 12
```

That runs the `factory-refine` skill on ticket 12.
[Skills](skills.md#at-a-glance) lists the other commands.

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
/factory-build 12
```

Running `factory-build` on a ticket is how you approve it. The session
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

To ask for changes, comment on the pull request, then have a session
answer your comments:

```text
/factory-address-review 15
```

**It worked when** the pull request is merged and ticket 12 is closed.
That is the whole loop: **ticket, refine, build, read, merge.**

## If something goes wrong

| What happened                                  | What to do                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A test or a check fails during the build       | Nothing. The session sees the output, fixes the cause, and tries again                    |
| The session stops and says it needs you        | It says why, in the session and on the ticket. Answer, then run `/factory-build 12` again |
| The build stops on `commands.gate is not set`  | Add your test and lint commands, as in step 2, then run `/factory-build 12` again         |
| The session was closed or crashed partway      | Run `/factory-build 12` in a new session. It picks up the branch it made                  |
| You want to change what was decided            | Run `/factory-refine 12` again, or edit the ticket                                        |
| CI fails on the pull request                   | Run `/factory-address-review 15`. It reads the failure and fixes it                       |
| The session does not know the factory's skills | The setup is not merged, or the session started before it was. See step 3                 |
| Anything else                                  | Run `factory doctor`. It says what is wrong, and what to do about it                      |

## What to add next

Everything above runs on your machine while you watch. Each of these is
optional, stands alone, and can come later.

- **An automated review, a board, builds in the cloud, builds that start
  from the board, and pull requests that merge themselves.** Run
  `factory init` again and check the parts you want. It asks for a token
  or two, sets everything else up, and opens a pull request titled
  "Change the software factory's settings" with the files it changed,
  and says how to bring your default branch up to date once it merges. In
  an organization whose owner has run the factory's setup for it, init
  asks for no token.
  [Setting up on GitHub](github/setup.md#run-factory-init) says what each
  part gives you and what it asks.
- **A command before every commit a session makes,** such as your linter:
  a few lines under
  [`commands.before-commit`](configuration.md#commandsbefore-commit).
- **Your own reviewers,** so a change to your content or your design is
  read by an expert agent: a few lines under
  [`plugins`](configuration.md#plugins), which [Plugins](plugins.md)
  walks through.
