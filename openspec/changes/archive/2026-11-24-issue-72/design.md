# Design

## Where it goes

- **`src/lib/repositories.mts` (new), pure.** Parses and writes the `## Repositories` section (fenced blocks ignored, through `lib/fences.mts`), checks owners, pairs, and circles, orders by merge, and answers `nextToBuild`, `waitsFor`, `allMerged`, and the derived state from `{ repositories, pulls by repository, finishedNoteAt }`. Everything below calls it. `rules`-like split: no I/O.
- **`src/across.mts` (new), the I/O.** `openAcross(env, settings)` gives a code host and a runner for any of a ticket's repositories: in a run, over the `fetch` transport with the second token (Contracts), and on a machine over `gh`, as today. `factory across --event FILE` is what the new job runs, with the event's file as the board's `collect` takes it: lines 50, 51, 53, 57. `factory workspace` is `src/workspace.mts` (new).
- **Ticket adapter** (`src/tickets/types.mts`, `github.mts`, `index.mts`): `key(typed)` accepts `owner/name#N` and normalizes the checkout's own to `N`, so `githubKey` takes the repository; `home(key)` returns the repository a ticket lives in, or null for a system whose tickets live in none (Jira then counts the first named repository as the one whose sync finishes it); every call routes to `repos/HOME` by its key; a comment's ID for a foreign ticket is opaque text, `owner/name:ID`; `githubLinksIn` takes the repository and reads both forms; `mayDecide(author, ticket?)` checks the ticket's home. The hosted poller and `keyOf`/`refOf` call sites pass the repository.
- **Where a foreign ticket's calls get their sign-in in a run:** the adapter takes a transport per home, the run's own for its repository and `openAcross`'s for any other, so the main token is never widened.
- **`src/ticket.mts`:** `repositories` (read and recording), the claim's checks before its comment, `link`, `branch` (`ticketWord`: `NAME-NUMBER`), `edit` keeping the section, `end` keeping a claim whose repository has a pull request. `claimPath` and `clockPath` name a file by the ticket's full key, `owner-name-N`, and the clock holds the full key, so a checkout of any repository finds them. In a clone, `commonDir()`'s callers for both follow the file `factory-session` that `factory workspace` writes in the clone's git folder, which holds the first checkout's common folder. `claim` and `cost` write there too.
- **`src/lib/work-status.mts`:** `derive`, `toClear`, and `reviewingPulls` take what `lib/repositories.mts` derived for a ticket with the section, and change nothing for one without. New `CommentKind`s: `built-next` (markers `released` then `started`), `repository-added` (`released`), `all-merged` (new marker `finished`, which ends a claim and leaves a reopened ticket in the backlog), and `pull-closed` with the repository in its name.
- **`src/board.mts`:** `apply`, which holds the token, reads the other repositories' pull requests for tickets with the section, through `openAcross`, and the nightly `collect` runs line 54 after it. **`src/status.mts`** reads them with the person's sign-in.
- **Cloud run:** `src/session-prepare.mts` (lines 38 to 44, 47), `src/session-publish.mts` (45, 46), `src/session-run.mts` (lays `in/others/*.bundle` out under `others/`, added to `readOnly`), `src/handoff/index.mts` (`RunFile.others: { repository, branch, pull }[]` and `ticketHome`), `src/handoff/links.mts` (line 46), `src/session.mts` and `session-token.mts`.
- **Verdict:** `src/review-verdict.mts` and `review-record.mts` both end in one function that posts "Merge order" and applies line 61, so a review ending and an event agree. `factory review verdict --pr N` is the `order` job.
- **`src/merge-policy.mts`:** one reason before the files are read.
- **`src/config.mts`:** `targetOf` takes `settings.repository` first. `board.mts` and `merge-policy.mts` read it through the settings. `reachOf`, `review-verdict.mts`, and `update.mts` keep GitHub's name.
- **`src/sync.mts`:** `permissions.additionalDirectories`, and line 71 on a `pull_request` event only. `withoutHooks` takes the entry out, and drops an emptied block.
- **`src/workflow-files.mts`, `run.yml`, `session.yml`:** the job and dispatch of lines 65 and 66, `order` in the `Unknown job` list, and `factory.yml`'s run name, which writes a key with `/` as it is.
- **Skills:** `factory-refine` (asks, records, runs `factory workspace N`, a repository in each capability heading, the body template), `factory-build` (workspace, a loop over checkouts in merge order, each with its own `CLAUDE.md`, gate, reviewers, specs, and `factory ticket link`, removal at the end), `factory-address-review` (each pull request in its own checkout, and its own `factory pr watch`), and `rules.md` ("A pull request that resolves an issue closes it", and "A session in the cloud").

## Contracts

- The section: `## Repositories`, then `- OWNER/NAME[, after OWNER/NAME]...`. The parser takes a name of two or more parts joined by `/`, the owner being all but the last, so GitLab's groups fit. The `repository` setting's own check stays as it is.
- The link lines: `Part of REF`, then `Depends-On: OWNER/NAME#N` lines. The code reads only the first.
- A pull request counts for a ticket when its body links it `Part of`, it is from the repository itself, and it is open, or merged after the newest `finished` marker.
- Markers: `<!-- work-status: finished -->`, and `<!-- repositories: acme/api acme/web>acme/api -->` on the confirming note, `>` before each it merges after. Publish strips markers from a session's text, so no session can post either.
- A confirmation is checked with `canWrite` of each repository's code host, by the second token in a run, and asks once for each account.
- The second token under the App: `{ contents: read, pull_requests: read, issues: write, actions: write }`, for the ticket's home and its repositories without the run's own; the verdict's job asks `{ contents: read, pull_requests: read, issues: read }`. It is made in the process that uses it from `FACTORY_APP_CLIENT_ID` and `FACTORY_APP_PRIVATE_KEY`, and is never printed, stored, or put in a step's output. First for the ticket's home alone, to read the section, then for the rest. On a person's account it is `FACTORY_BUILD_TOKEN`, which `factory.yml` already falls back to the board token for.
- Where the App's key is named in a new place (the verdict's job and the new job), the job checks out the default branch and runs no session and nothing of a pull request's.
- `others` bundles: one shallow commit each, 20 MB at most; a larger one is left out, and the run says so.
- Merge order is decided from the ticket as it is when the status is posted. A status's description is at most 140 characters, with `…` for the rest.
- The lock's `settings.tickets.fields.repositories` is what lines 3 and 5 look for: a fact of the version, not a version number.
- Folder: `~/.local/share/software-factory/work`, literal in `.claude/settings.json`, since the entry cannot hold a variable.

## States

A ticket with the section, first match: finished in its system, Done. Every repository has a counting pull request and one is open, In review. A live claim or start, In progress. Ready, by today's rule. Any counting pull request, In progress and "Waiting on you". `Derived.pulls` stays this repository's numbers, and a new `across` lists every open one as `{ repository, number }`, in In progress too. Otherwise as today. A repository is unbuilt, in review, or merged; `nextToBuild` is the first unbuilt in merge order. Every repository merged and the ticket open is the moment line 51 acts, whatever event brought it.

## Edge cases

- Two last pull requests merging at once: each run finds all merged. The `all-merged` note is added only when no `finished` marker is newer than the newest merge, and `finish` is already a no-op on a closed ticket.
- The ticket's home is not among its repositories: allowed. Line 2's and 8's "own repository" is then absent from the list, every body says `Part of owner/name#N`, and the home needs the factory set up for its card to move.
- A person's pull request with `Part of #12` written by hand counts, as it does for the follow-ups ticket.
- A fork's pull request never counts and gets no status, since no secret reaches its run.
- A start Prepare forwards leaves the poller's `started` marker, which the next claim clears.
- A repository renamed on GitHub after it was recorded: GitHub answers under the new name; compare by the answer's name and say `not found` only on a 404.
- `--set` with no change posts nothing and prints the list.
- The session's checkout is a worktree of `acme/api`: it is the checkout as any.
- A partial clone needs the network later, so clone in full; `git clone --reference-if-able` is not used, since a deleted source breaks the clone.

## Risks and rollback

- `targetOf` reads the line in a run: a stale line then acts on another repository. Line 71 catches it on the pull request that would merge it, and GitHub redirects a renamed one. Rollback is one line.
- "Review verdict" held by a bad read: line 58 never waits with no token, and dropping the pair from the list clears line 59. Rollback is line 61's call.
- A hijacked session in one repository still writes to none other. Check that `others/` is under `denyWrite` in the sandbox's settings test.

## Dependencies

- None the owner has to do first. #73 and #74 are merged. #63 waits on this ticket.
- **Live checks** need two scratch repositories in `aphiria` with the App installed, on a `trunk` branch, private and then public, cleaned up after. Ask the owner before making them: an App has to exist there again.

## Checked while refining

Claude Code 2.1.310: a folder in `permissions.additionalDirectories`, with `~`, can be read, edited, and stayed in by `cd`, once the workspace is trusted. Its `CLAUDE.md` does not load by itself, and its agents are not found by name: hand an agent's file to a general-purpose one. A hook's `cwd` follows `cd`, so the guards judge the checkout a command runs in.

## Where the build departed

- A run makes one token for each other repository, never one for several, so each is narrower than the second token Contracts describes.
- A link to another repository's ticket counts only at the start of its line, and no link counts in code, so a pull request that writes about one is not part of it.
- Another repository's files are handed over as an archive git makes, not a bundle of one shallow commit, which git refuses to read without the commit before it.
- `factory workspace` ends a line with `built in acme/api#88` for a repository that has its pull request, so a build goes on from there.
- `factory pr state --wait` and the watch count a check that waits only for another repository's pull request as finished, since nothing the session does can end it.
