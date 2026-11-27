# Design

## Where it goes

- **`README.md` and `docs/`:** the pages, by the layout and "Where today's pages go". `docs/developing.md` stays where it is; only its links and "A page a reader follows" change. "Writing for the factory" in `docs/developing.md` holds for every page, and `docs-reader` reads each new or rewritten page, one run per section.
- **The printed addresses:** `docsPage` in `src/init-shared.mts` stays the one way an address is made. Its callers are `src/init.mts` (the quick start, and `steps(section)` for the Free plan and the secrets), and `src/init-org.mts`. `src/config.mts` (the version 1 failure) and `src/cli.mts` (the usage's last line) call it too. Neither has the installed version today, and `src/init-shared.mts` pulls in init's modules, so move `docsPage` and the table below into a new `src/lib/docs-page.mts` that imports only what the address needs, with a helper that reads the installed version from the package's own `package.json`, as `init` reads `manifest.version`. `src/init-shared.mts` re-exports `docsPage`, `init` and `init --org` keep passing the version they are given, and `config.mts` and `cli.mts` call the helper. Put every page the code prints, each as its path under `docs/` with its anchor, such as `get-started/quick-start.md#4-open-a-ticket`, in one exported table beside `docsPage`, such as `DOCS_PAGES`, and have each caller name its entry, so one test reads them all.
- **The specs:** `factory specs new 125` at the start, `factory specs finish 125` at the end, in the same pull request. `docs` gets each of its 44 requirements that names a page restated with the new path.
- **`docs/developing.md`'s links:** every relative link in it is repointed, such as `configuration.md#...` to `reference/settings/...` and `cli.md#which-version-runs` to `get-started/install.md`; the test for a link to a missing file or heading checks them.
- **Sections the layout does not name:** "Words this page uses", "How the file works", "The settings most repositories change", and "Checking the file" in `docs/configuration.md` go to `docs/reference/settings/README.md`. In `docs/cli.md`, "Your repository's commands" becomes a `##` heading on `docs/reference/cli.md`, after "Presets", so the usage test still finds the five groups there; "Exit codes" stays on `docs/reference/cli.md`; and "`factory site`" goes to `docs/features/website-review.md`.
- **"What each developer does next"** on `docs/setup/organization.md` holds the two steps `factory init --org` prints after `✓ acme is set up.`: each developer installs the factory once, then runs `factory init` in the repository's checkout, which asks for no token. It links to "In an organization" on `docs/setup/repository.md` for what that run shows.
- **Other files that name a page:** `.claude/factory.yaml`'s opening comment (`docs/configuration.md`, now `docs/reference/settings/README.md`), `CLAUDE.md` ("What a hijacked session could still do" in `docs/credentials.md`, now `docs/security/risks.md`), the examples in `.claude/skills/dx-first/SKILL.md` (edited in place: it has no source elsewhere), and the comments in `src/columns-suggest.mts` and `src/config.mts`. Each is wording, so no trace.

## On your tools, by feature

Spec line 8's links, from the kinds each feature needs:

| Feature page               | Links in "On your tools"                                  |
| -------------------------- | --------------------------------------------------------- |
| `automated-review.md`      | GitHub Actions, Claude Code, GitHub, GitHub organizations |
| `board.md`                 | GitHub Projects, GitHub, GitHub organizations             |
| `cloud-builds.md`          | GitHub Actions, Claude Code, GitHub, GitHub organizations |
| `builds-from-the-board.md` | GitHub Projects, GitHub Actions, GitHub organizations     |
| `hosting-the-poller.md`    | GitHub Projects, GitHub Actions                           |
| `auto-merge.md`            | GitHub Actions, GitHub                                    |
| `approval-policies.md`     | GitHub Actions                                            |
| `credentials-policy.md`    | GitHub Actions, Claude Code                               |
| `specs.md`                 | OpenSpec                                                  |
| `dependency-updates.md`    | GitHub Actions, GitHub                                    |
| `website-review.md`        | Claude Code                                               |

This table is the whole list. GitHub organizations is linked where the feature reads the organization's secrets.

## Contracts

- An address is `https://github.com/davidbyoung/software-factory/blob/vX.Y.Z/docs/PATH#ANCHOR`, or `blob/main/` for a version that is no release, as `docsPage` makes it.
- Anchors are GitHub's: lowercase, spaces to hyphens, punctuation dropped, so "What each developer does next" is `#what-each-developer-does-next` and "On GitHub's Free plan" is `#on-githubs-free-plan`.
- A setting's anchor on its page is the one it has on `docs/configuration.md` today, such as `#ticketsfields`.

## States

n/a: pages and printed lines, with no state.

## Edge cases

- A link from `README.md` is relative to the root (`docs/...`); a link between pages is relative to the page's folder (`../reference/...`). The test for a link to a missing file or heading covers both.
- A page linked from a skill, agent, or rule the package ships would break in a user's repository. None links a page today except `docs/developing.md`, which stays; keep it so.
- A heading carried to a new page keeps its words, so an anchor another page links still resolves; where a split renames one, fix every link to it.

## Risks and rollback

- **A fact lost in the move.** The pull request lists each of today's headings beside its new address, made by a one-off script that is not committed. Rollback is reverting the pull request: a release's printed addresses name its tag, so nothing outside this repository breaks either way.
- **A printed address to a missing heading.** The new test fails on it.

## Dependencies

None to wait on, and no owner-only step. #63, #126, and #128 wait on this one, as recorded.
