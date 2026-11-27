# Proposal

From [davidbyoung/software-factory#125](https://github.com/davidbyoung/software-factory/issues/125). The layout, the pages the owner approved, and the addresses the commands print are in the ticket's "The layout" and "Proposed docs".

### What and why

The docs are hard to follow. Everything in them is worth keeping, but it is in the wrong shape, and this ticket gives it a new one: ten sidebar sections in place of four, one page for each feature, and one page for each tool the factory connects to.

- **Pages are sized by history, not by job.** `docs/configuration.md` is 1,895 lines, `docs/updating.md` 745, `docs/github/setup.md` 713, and `docs/existing-repo.md` 610. The setup page alone covers one person's setup, an organization owner's setup, GitHub's Free plan, public repositories, and private npm packages.
- **A feature has no page of its own.** The board is described in `workflow.md`, `existing-repo.md`, `github/setup.md`, `github/by-hand.md`, `github/reference.md`, and `configuration.md`. The automated review and pull requests that merge themselves are spread the same way.
- **Tool detail is everywhere.** The glossary says the pages "name the kind, not the tool", but `credentials.md` names GitHub 54 times, `configuration.md` 29, and `cli.md` 13. No page answers "what do I need for GitHub Projects?", "for GitHub Actions?", or "for Claude Code?" on its own.
- **The README's docs list is four flat groups** (Start here, Guides, Reference, About), and "Guides" mixes daily use, optional features, security, and upkeep.
- **Setting an organization up is far from setting a repository up,** so a developer can run `factory init` before learning that an owner runs `factory init --org` first.

### Done when

- `README.md` is a router of about 900 words: what the factory does, what you need, the install line, the three skill commands, a few everyday commands, what it works with, and one line per docs section.
- Every page below exists under its folder in `docs/`, and no page of today's is left behind. Nothing true in today's docs is lost: each section has a destination in "Where today's pages go".
- Rules 2 and 5 below are written under "A page a reader follows" in `docs/developing.md`, and its rule that a setting links to its entry names the setting's page under `docs/reference/settings/`. Rules 1, 3, and 4, and the tests that hold them, are #128's.
- The gate passes, `docs-reader` has read each new or rewritten page, and the addresses the commands print lead to headings that exist, which a test checks.

### Decisions

- **Two tickets, not one pull request.** This one moves every page and writes the five new ones; #128 rewrites what names a product and puts the feature and integration pages on their shapes, so each review checks one thing. Agreed in Proposed docs, Q1.
- **A section's first page is `README.md`,** for `setup/`, `workflow/`, `features/`, `integrations/`, and `reference/settings/` (Q2).
- **A message that named a page by a bare path prints its address,** the installed version's, as `factory init` already does: the settings version 1 failure and the last line of `factory`'s usage (Q3).
- **No page is left at an old address** (Q4). Two repositories use the factory, and an address a release printed names its tag.
- **The README names products** in "What you need" and "What it works with" (Q5).
- **The `--org` address moves to the owner's own page:** "What each developer does next" on `docs/setup/organization.md`, in place of the developer's "In an organization".
- **The organization's secrets and GitHub's Free plan** go to `docs/integrations/github-organizations.md`, since what to ask an owner for is GitHub's; `docs/integrations/github.md` links there for the Free plan.
- **"Your repository's commands" stays on `docs/reference/cli.md`,** with the commands a person runs, not on `cli-internal.md`: `factory`'s usage lists them among a person's commands, and the `cli-output` spec matches the usage to that page.
- **`version` and `repository`** sit on the settings index, `docs/reference/settings/README.md`, being a few lines each; the other 13 top-level keys get a page each.
- **The `spec` label,** since six lines that commands print change (Spec lines 13 to 18).
- **Blocked by nothing.** #63, #126, and #128 each wait on this one, recorded on each: Jira's page goes under `docs/integrations/`, the site's navigator is this layout's folders, and #128 rewrites the pages this one makes.
