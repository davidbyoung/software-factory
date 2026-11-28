# Website review

For a repository that is a website. At the end each change that affects
a page is pictured before and after, in a browser the factory drives, and
read by a UI reviewer: an agent that looks at those pictures for
usability and design.

## What you get

Before you see a visible change, its pages are pictured before and after,
measured, and read by the UI reviewer.

## What it needs

The [`site`](../reference/settings/site.md#site) settings, which say how
to start the website.

## Turn it on

### The UI reviewer

`factory-ui-reviewer` ships with the factory and is written to any repository
with [`site`](../reference/settings/site.md#site) in its settings, but runs only where it is listed:

```yaml
plugins:
  build:
    reviewers:
      - agent: factory-ui-reviewer
        files:
          - src/**
          - public/**
```

## How it works

### `factory-design`

**What it does.** Designs a visible change to a website as a designer
would: one recommended design in real content, built from your site and
pictured by `factory site compare` at your widths in light and dark,
reviewed by `factory-ui-reviewer` before you see it, and shown beside the
page as it is. It reads your `design-guide` when you wrote one, and who
your visitors are from your project's own instructions.

**When to use it.** When asked to redesign or restyle a page, and from
`factory-refine` when a decision changes how something looks. A
repository with `site` in its settings gets it as its
[`mockups` plugin](../customize/plugins.md) without listing it; one without `site`
does not get it at all.

**What it never does.** Make a mockup of a change with no look to choose,
or one made by editing a running page instead of building it. Leave a
scratch worktree behind.

### `factory site`

`factory site compare` starts the working tree with
[`site.start`](../reference/settings/site.md#site), starts the default branch from a
temporary git worktree on another port, shoots each page at each width in
light and dark, and prints the pages that changed, with the pixels and
rows. It writes the pictures before, after, and with what changed
outlined, and `report.json`, under `node_modules/.cache/factory/site/`. It
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
  `--site FOLDER` compares the one site in that folder,
  whatever changed. With several sites, `--keep`, `--before`, and
  `--after` need `--site FOLDER`.
  A site the default branch doesn't have yet is pictured alone, every page
  of it new.
- `--base REF` compares against something other than the default branch.
- `--keep` leaves both sites running and prints their addresses, for a state
  that takes a click to reach. `factory site stop` ends them and removes the
  worktree.
- `--before URL --after URL` compares two sites that are already running and
  starts nothing. One without the other is refused.

## Its settings

[`site`](../reference/settings/site.md#site) says how to start the website
and what `factory site compare` measures, and
[`plugins`](../reference/settings/plugins.md#plugins) lists the UI reviewer.

## When something goes wrong

`factory site compare` exits non-zero only when it could not do its job.
What got worse on a page is not a failure: it prints as a `measured:`
line.

## On your tools

- [Claude Code](../integrations/claude-code.md)
