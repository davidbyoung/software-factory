---
name: factory-design
description: Design a visible change to a website, a new page or a redesign, as the designer rather than asking the owner to be one: real-content mockups built from the site itself, pictured at its widths in light and dark, reviewed before anyone sees them, and one recommended design. Use when asked to redesign, restyle, or rethink how a page looks or what it says, when an issue asks for renderings to approve, and as the `mockups` plugin `factory-refine` calls.
---

# Designing a change

The owner hired an expert. Decide what an expert would decide, and bring
them a recommendation, not a menu. Each round the owner has to spend
catching a defect or making a design call is a round this skill exists to
remove.

It works on any site whose settings have a `site` block:
`site.start` says how to build and serve it, and `factory site compare`
pictures it.

## 0. Is there a look to choose?

A mockup answers one question: which look does the owner want? When there
is one acceptable look, there is no question, and a mockup round spends
the owner's time on nothing. Before drawing, read the issue's acceptance
criteria and Decisions. Stop here, and say why, when:

- the criteria say the page must look the same at rest, or the change is
  to targets, focus rings, contrast, or markup, and no Decision says the
  look changes; or
- the only choice is one the design guide already makes; or
- the change is small ("Small changes" in `.claude/factory/rules.md`): its
  pull request carries the built result, and that is the picture.

The proof for a change with no look to choose is not a picture of it. It
is `factory site compare` on the branch, whose
measurements and the site's own `checks` say whether anything got worse,
and, for a change to a state such as an open menu or keyboard focus, that
state measured as section 3 step 4 says. Say so in the report, so the
issue's acceptance criteria can name it.

## 1. Know the site before drawing

- **The design guide.** `factory config get
site.design-guide` names it. Read it first: its rules, each with its
  check. When it prints `none`, the site has no guide: design from the
  site's own pages, and say in the round that there was no guide.
- **The audience and the copy's rules.** They are in the project's own
  instructions, which you have read already: who the visitors are, what
  each should do next, and what copy must keep. When they say nothing about
  the visitors, work it out from the site's pages, its home page first,
  and say in the round what you took from them, so the owner can correct
  it.

A design that breaks a rule of the guide names the rule and the reason
under "Decisions" in its issue, for the owner to approve.

Then write down, for yourself:

- the page's audiences and the one action each should take
- what a visitor needs to know, in the order they will want it
- what the page must prove about the business
- the existing element each new piece copies

## 2. Draft one design, in real content

- Use the site's real copy, counts, images, fonts, and colors. Write the
  copy yourself; never leave "lorem" or a generic tagline for the owner to
  fix.
- **A mockup is a real build of the change,** pictured by `factory site
compare` (section 3), so it carries the site's own styles. Markup put
  into a running page is for posing a passing state only, such as an open
  menu, with inline styles, never for the design itself: a stylesheet
  built from the source may leave out a class the source has never used.
- **Nothing in a mockup misleads.** Sample text typed into one says
  nothing false about the site's real content, since a made-up complaint
  about a real page reads as a finding.
- **Every line of copy the Spec promises is in the mockup,** so no line
  points at a picture that does not exist.
- Make the calls that have a conventional answer yourself: section order,
  which button is primary, link and label styling, spacing, line length.
  Say what you decided and why in one line each.
- Offer alternatives only where the choice is genuinely the owner's: brand
  voice, which image, a headline that trades clarity for warmth. At most
  three, each shown, with your pick marked.

## 3. Make the round

Each round, fix rounds included, is these steps in this order. Each
depends on the one before.

1. **A scratch worktree of the default branch**, and the change made in
   it. Note what `git worktree list` shows first. From the checkout this
   session works in, with the default branch's name, which
   `factory default-branch` prints, in place of DEFAULT:

   ```bash
   git worktree add --detach ../mockup-SLUG origin/DEFAULT
   ```

   An option is its own worktree, made the same way. The change need not
   be committed: the comparison pictures the worktree as it stands.

2. **Install it,** in the scratch worktree: run there every relock
   command, which installs the repository's dependencies, then every
   command under `commands.build-setup`, each in its folders:

   ```bash
   factory relock --all
   factory build-setup
   ```

   The comparison installs the default branch's side, not this one, and
   the factory, the browser, and `site.start` all run from the scratch
   worktree.

3. **Picture it,** from the scratch worktree:

   ```bash
   factory site compare --keep
   ```

   With several sites, add `--site FOLDER` for the site the decision is
   about. It builds the change and the default branch, pictures every page at the
   site's widths in light and dark, outlines what changed, measures each
   changed view, and runs the site's own `checks`. It leaves both sites
   running and prints their addresses. Its pictures are under the scratch
   worktree's `node_modules/.cache/factory/site/`.

4. **Pose the states** the design is about, such as a menu open or a form
   with an error, against the two addresses, as `factory-ui-reviewer`'s
   step 3 says, in the same views. Pose each the same way in light and
   dark, so a pair differs only in its scheme: the same content, any
   randomness the page uses seeded, phone emulation for a phone view (so
   no desktop scrollbar shows), and the pointer moved off the page. Picture
   each state, and measure it the way the site's design guide says to
   measure a posed state, when it says.
5. **Copy the round out** before anything else goes: the changed views'
   pictures, the posed states' pictures, the comparison's lines, and each
   posed state's measurements, into a folder git ignores in the checkout
   this session works in, `node_modules/.cache/factory/design/` with the
   time in its name.
6. **Review it,** as section 4 says, from that folder.
7. **Stop and clean up,** from the scratch worktree:
   `factory site stop`, which ends both sites and removes
   the default branch's worktree. Then, from the checkout this session
   works in, `git worktree remove --force ../mockup-SLUG`, and check that
   `git worktree list` shows what it showed before step 1.

A round that stops partway still runs step 7.

## 4. Review every round before anyone else sees it

1. Have `factory-ui-reviewer` read the round in its "From screenshots"
   mode, handed the round's folder from step 5: the pictures, every
   `measured:` line and `checks` line the comparison printed, and each
   posed state's measurements. Fix every high and medium finding, or
   record the break as a Decision, then make the round again.
2. Put the comparison's lines and what the reviewer found in the round you
   send, quoted.

## 5. Present, then build

Show each mockup beside the current design, its before and after pictures
together, with the recommendation first and a short "what changed and
why". In a session with the owner, send the pictures rendered; in a
comment round, attach them. Every option offered to the owner is mocked;
an option with no picture is not offered. Ask only the question that
changes direction.

Once approved, the build makes it in code, and its pull request carries
`factory-ui-reviewer`'s pictures of the real page.
