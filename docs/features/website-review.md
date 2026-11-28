# Website review

For a repository that is a website. At the end each change that affects
a page is pictured before and after, in a browser kodor drives, and
read by a UI reviewer: an agent that looks at those pictures for
usability and design.

## What you get

Before you see a visible change, its pages are pictured before and after,
measured, and read by the UI reviewer.

## What it needs

The [`site`](../reference/settings/site.md#site) settings, which say how
to start the website, and a browser for kodor to drive, which
`npm install -D playwright` installs in your repository. Until it is
installed, `kodor config check` fails on settings with `site`.

## Turn it on

Write [`site`](../reference/settings/site.md#site) in
`.claude/kodor.yaml`. Most sites need two lines: the command that
builds and serves the site on the port kodor gives it, and the
address it serves at:

```yaml
site:
  start: npm run build && npx serve out -p $PORT # build the site, and serve it on $PORT
  url: http://localhost:$PORT # where kodor opens it
```

Then run `kodor sync`, which writes the UI reviewer and
`kodor-design` into your repository.

**It worked when** `kodor site compare` starts your branch and the
default branch, takes the pictures, and prints where it saved them.

### The UI reviewer

`kodor-ui-reviewer` ships with kodor and is copied into any repository
with [`site`](../reference/settings/site.md#site) in its settings, but runs only where it is listed:

```yaml
plugins:
  build:
    reviewers:
      - agent: kodor-ui-reviewer
        files:
          - src/**
          - public/**
```

## How it works

### `kodor-design`

**What it does.** Designs a visible change to a website as a designer
would: one recommended design in real content, built from your site and
pictured by `kodor site compare` at your widths in light and dark,
reviewed by `kodor-ui-reviewer` before you see it, and shown beside the
page as it is. It reads your `design-guide` when you wrote one, and who
your visitors are from your project's own instructions.

**When to use it.** When asked to redesign or restyle a page, and from
`kodor-refine` when a decision changes how something looks. A
repository with `site` in its settings gets it as its
[`mockups` plugin](../customize/plugins.md) without listing it; one without `site`
does not get it at all.

**What it never does.** Make a mockup of a change with no look to choose,
or one made by editing a running page instead of building it. Leave a
scratch worktree behind.

### `kodor site`

`kodor site compare` starts the working tree with
[`site.start`](../reference/settings/site.md#site), starts the default branch from a
temporary git worktree on another port, shoots each page at each width in
light and dark, and prints the pages that changed, with the pixels and
rows. It writes the pictures before, after, and with what changed
outlined, and `report.json`, under `node_modules/.cache/kodor/site/`. It
exits 0 whether or not anything changed, and non-zero only when it could
not do its job.

- **Three measurements** are made on each view that changed, a view being one
  page at one width in one scheme, on the base and on the branch, and only what
  got worse prints, one `measured:` line each after the table, beside the lines
  your `site.checks` print, and the same in `report.json`:
  - **Accessibility,** by axe-core at the level `site.accessibility` names
    (`wcag22aa` by default), including text contrast and the standard's target
    size. A failure is new when the base has none of the same rule on an
    element with the same selector or the same markup.
  - **A page that scrolls sideways** on the branch and not on the base.
  - **A new style value:** a font size, color, spacing, or corner radius that
    the base uses in no view of that scheme. It is a fact to weigh, not a
    failure. `site.new-values: false` leaves it out.

  ```text
  measured: /about/ 390 light: accessibility color-contrast: p.intro: Element has insufficient color contrast of 2.5 (foreground color: #9aa5b4, ...). Expected contrast ratio of 4.5:1
  measured: /about/ 390 light: sideways scroll: the page is 412 px wide in a 390 px window
  measured: /about/ 390 light: new value: font-size 15px on h2 "Background"; the site uses 12, 14, 16, 18, 24, 30, and 36 px
  ```

  A page the base does not have is measured alone, and everything found on it
  is new. A view whose pictures did not change is not measured.

- **With several sites,** a list under [`site`](../reference/settings/site.md#site), it
  compares each site the branch's change touches, one after another, after
  a line that says which and why, and saves each site's pictures in a
  folder of its own, named for the site's folder, inside that run's
  folder under `node_modules/.cache/kodor/site/`, which is named for the
  time the run started. `--site FOLDER` compares the
  one site in that folder, whatever changed. With several sites, `--keep`, `--before`, and
  `--after` need `--site FOLDER`.
  A site the default branch doesn't have yet is pictured alone, every page
  of it new.
- `--base REF` compares against something other than the default branch.
- `--keep` leaves both sites running and prints their addresses, for a state
  that takes a click to reach. `kodor site stop` ends them and removes the
  worktree.
- `--before URL --after URL` compares two sites that are already running and
  starts nothing. One without the other is refused.

## Its settings

[`site`](../reference/settings/site.md#site) says how to start the website
and what `kodor site compare` measures, and
[`plugins`](../reference/settings/plugins.md#plugins) lists the UI reviewer.

## When something goes wrong

`kodor site compare` exits non-zero only when it could not do its job.
What got worse on a page is not a failure: it prints as a `measured:`
line.

### When it can't start the site

It prints `the site did not answer at` the site's address, then the last
lines your `site.start` command printed. With `(its command exited)`,
the command stopped before the site answered: run it yourself, with
`PORT` set, and fix what those lines show. With `in 5 minutes`, or the
minutes you set, the site was still building, or serves at another
address than [`site.url`](../reference/settings/site.md#site) says: check
the address, or raise `site.start-minutes`.

With `--before` and `--after`, `nothing answers at` an address means
that site isn't running: start it, and run the command again.

## On your tools

- [Claude Code](../integrations/claude-code.md)
