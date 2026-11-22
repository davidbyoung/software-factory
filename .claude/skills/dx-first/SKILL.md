---
name: dx-first
description: Draft what a developer types and sees, as command transcripts, files, workflow diagrams, and finally the docs page, and agree it with the owner before the ticket is refined into a spec. Use before refining a ticket that adds or changes a command, a command's output, a setting, a file the factory writes, or a docs page, and when the owner asks for it with `/dx-first N`.
---

# Drafting the developer experience first

A factory user meets a feature as the commands they type, what those
commands print, the settings and files they read and write, and the docs
page that tells them how. This skill drafts all of that before any
requirement is written, settles it with the owner, and saves it into the
ticket as `## Proposed docs`, so refinement works backwards from the
experience the owner approved.

Requirements written first settle things the draft later shows to be
wrong. On #29, picturing `factory preset add` and a preset update changed
how presets combine, what the user is asked, and where their choices are
saved, after requirements had settled some of these differently.

The ticket is N throughout. `factory ticket` commands are run as
`npx --no-install factory ticket`, as every skill runs them; the draft
itself writes commands the way the docs do (step 1).

## 0. Where the draft lives

Everything the draft is made of goes under `.dx-first/N/` in the session's
folder, which `.gitignore` leaves out, so a later build finds a clean tree:

- `draft.md`: the syntax and workflows, as Markdown with Mermaid blocks.
- The docs page, once there is one (step 6), as one Markdown file at the
  path it will have in the repository, such as `.dx-first/N/docs/presets.md`.
- `draft.html`: the page the owner reads. It renders those Markdown files
  as they are, Mermaid included, so the owner reviews the text that ships,
  not a copy of it.

Where the session has the Artifact tool, as in the desktop app, publish
`draft.html` as a private Artifact, and republish it from the same path
each round so its link stays the same. Elsewhere, send it rendered with
`SendUserFile` each round.

**When the owner is not in the session,** as in a refinement that runs as
a comment round, there is no page: the draft goes in a comment ("Nobody
in the session").

## 1. Read

```bash
npx --no-install factory ticket view N
```

Then read:

- the code the ticket touches and the spec `npx --no-install factory specs list`
  prints for each capability it touches;
- the docs pages next to the one the draft will change, and the page it
  changes, if there is one;
- "Writing for the factory" in `docs/developing.md`.

The draft follows the docs' conventions, not the session's. Commands are
written `factory ...`, the global install `docs/cli.md` describes, not
the `npx --no-install factory` form the skills use. On #29 the draft wrote
every command the skills' way and the owner had to catch it.

Run on its own, post the `refining` marker first, so the card shows the
ticket is being worked: `npx --no-install factory ticket refining N`.
Invoked from refinement, it has already been posted.

## 2. Recommend one design

The first draft goes out before any question. It is one recommended
design, not a menu of options: the owner reacts to something concrete,
and the two refine it. It has:

- **A transcript of each command the reader runs,** with its whole output,
  on success and on each way it fails or asks something. Each transcript
  follows "A command's output" in `docs/developing.md`, not the rules for
  a page.
- **Each file the reader writes or reads,** in full: the settings they
  paste, and the files the command writes for them.
- **A Mermaid diagram of each workflow,** such as a first install, an
  update, or a change made by a second person.

Each open question sits inline where it arises, with its recommendation,
so the owner answers it in place. Tag anything that changes or adds to the
ticket's existing Decisions as **Changes a Decision** or **Adds a
Decision**, with the Decision it touches.

## 3. One draft, updated every round

The draft is the deliverable. On #29 two rounds of answers lived only in
chat while the draft stayed at round 1, until the owner pointed it out.

Every round updates `draft.md`, and the docs page once there is one,
renders `draft.html`, and republishes it to the same place, in the same
turn as the reply. The chat says only what changed and why. An answer
that does not reach the draft is not settled.

## 4. Walk the first time

Before writing the docs page, walk each reader's first use from nothing:
a fresh machine, then the repository's CI, then the dependency bot,
credentials included. The reader is each person the feature has, such as
the author of a preset and the developer who uses it.

On #29, "how do we actually get a preset?" found the largest gap: a
private preset, the usual case for a company, made every factory workflow
fail at `npm ci`, and Dependabot could not see its updates. Neither the
requirements nor three rounds of transcripts had followed the package that
far. Put what the walk finds in the draft, as transcripts and open
questions.

## 5. Work for another ticket

When the draft turns up work another ticket should own, propose it to the
owner, and once agreed open it:

- a change a user would see gets its own ticket, with
  `npx --no-install factory ticket open`;
- a finding gets a line on the follow-ups ticket, with
  `npx --no-install factory follow-up FILE "..."`, as "Follow-ups" in
  `.claude/factory/rules.md` says.

The draft marks that work _Planned_, naming the ticket, as "Writing for
the factory" says a page marks anything not built. On #29, private
registries turned out to break the factory for any private dependency,
not only presets, and became #31 rather than growing #29.

## 6. The docs page

Once the owner says the syntax and workflows hold, write the docs page as
one Markdown file under `.dx-first/N/`, at the path the page will have in
the repository, and render it in the draft. Writing it tests the design:
each flow has to say what the reader needs first and how they know it
worked, and that exposes what the transcripts left open, such as what
answering no leaves behind. Put each gap it finds back into the
transcripts.

Then have the `docs-reader` agent read the page cold, and fix its findings
before the owner reads the page. On #29 its read found 21 problems, and one
changed the design: `factory preset check` printed nothing on success,
which could not show an author that a preset in a subfolder was found, so
it now lists each preset it found.

## 7. Check each output against what is stored

Before saving, trace each line of output the draft shows, in a transcript
or the docs page, to the data that produces it: a setting, a file the
factory keeps, or the command's input. Where nothing stored produces it,
change the draft: store it, or stop showing it. Check each link in the
docs page goes somewhere that exists or is marked _Planned_.

On #29, `factory-ticket-readiness` found the drafted update comment needed
a losing preset's old value, which the drafted lock did not keep, and the
docs page linked a section only #31 would write. The draft is a promise
about behavior.

## 8. Save into the ticket

When the owner says to save:

```bash
npx --no-install factory ticket view N --field body > .dx-first/N/body.md
# edit body.md, then
npx --no-install factory ticket edit N --body-file .dx-first/N/body.md
```

Add a `## Proposed docs` section to the body, after the owner's text and
before `## Decisions`. It holds, in order:

1. the syntax and workflows from `draft.md`, as Markdown with Mermaid
   blocks, which GitHub draws;
2. the docs page, with every heading two levels deeper, so its `#` is
   `###` and it nests under `## Proposed docs`;
3. the other docs pages that change, each as the lines that change.

The ticket must hold it all: an Artifact is private, and a build in GitHub
Actions cannot read it.

Saving reconciles the body, not only appends to it. In the same edit,
rewrite each Decision and open question the draft settled or changed, so
no section of the body disagrees with the draft; refinement would
otherwise read two designs. On #29 that rewrote "Lists replace, maps
merge", answered every "Needs a decision" item, and fixed two wrong key
names. Change the owner's own text only to fix a fact the draft shows
wrong, and name each such fix to the owner in the session.

## 9. Hand back

Invoked from refinement, return to it: refinement carries on in the same
session from the saved body. Run on its own, end by saying `/factory-refine
N` is next, typed in this session so the draft stays in its context.

## Nobody in the session

When the owner is not in the session, steps 1, 2, 4, 5, and 7 still run,
and the draft goes out as one comment on the ticket instead of a page:

- `draft.md` as it stands, with its Mermaid blocks, and the docs page once
  there is one;
- the open questions numbered, each with its recommendation, so a reply
  can name one ("reply with the numbers you disagree with; anything you
  leave alone goes ahead as written, and a reply that says save, or
  approving the ticket, saves it");
- `<!-- dx-first: draft -->` as its last line, so a later run and a build
  can tell the round waiting is this draft.

```bash
npx --no-install factory ticket comment N --body-file .dx-first/N/comment.md
npx --no-install factory ticket waiting N
```

Then stop: refinement stops with it.

**A later run,** by `/dx-first N` or by refinement through `CLAUDE.md`,
reads the owner's replies since the newest draft comment. Only the owner's
comments are answers.

- **A reply that says to save,** or the owner approving the ticket, saves
  the draft (step 8) with the replies folded in. The owner approves it by
  asking a session to build the ticket, which reaches this skill through
  refinement, or, when the body already has criteria, through the words a
  build invokes refinement with, "approved while waiting". That save
  posts no marker, and refinement carries on.
- **Any other reply** gets the next round as a new comment, never an edit
  of the last one, since the owner may already have read it.
- **No reply and no approval:** say the draft still waits on the owner,
  and stop.
- **After two comment rounds,** ask in the conversation instead of a
  third. With nobody in the session, post nothing more, and say the draft
  waits for a session the owner is in. These rounds count apart from
  refinement's own two.

Step 5 asks here rather than acts: put each ticket it would open in the
comment as a numbered question, and open it once a reply agrees.
