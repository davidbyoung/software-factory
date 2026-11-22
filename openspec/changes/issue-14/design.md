# Design

From [davidbyoung/software-factory#14](https://github.com/davidbyoung/software-factory/issues/14).

## Where it goes

- `src/tickets/github-access.mts` (new): `writeAccess(t: Transport, repository: string, login: string): Promise<boolean>`, the one lookup both GitHub adapters call. It reads `GET repos/OWNER/REPO/collaborators/LOGIN/permission` with the login URL-encoded (a bot's login holds brackets), and returns whether `permission` is `admin` or `write`. A 404 means the name is no account only when the repository itself can be read: on a 404, read `GET repos/OWNER/REPO`, return `false` when that succeeds, and reject when it does not, since a token that cannot see a private repository gets a 404 for every name. Any other failure rejects. It lives under `src/tickets/`, where `src/code-host/github.mts` already imports the transport from, so `tests/boundary.test.ts` passes unchanged.
- `src/code-host/types.mts`: one new method on `CodeHost`, `canWrite(login: string): Promise<boolean>`. `src/code-host/github.mts` implements it with `writeAccess`.
- `src/tickets/types.mts`: one new required method on `Tickets`, `mayDecide(author: string): Promise<boolean>`: whether that comment author's words count as instructions on a ticket. `src/tickets/github.mts` implements it with `writeAccess`. `withTicketFields` in `src/tickets/index.mts` spreads the inner adapter, so it passes through. "Adding a ticket system" in `docs/developing.md` gets a row for it in the operations table.
- `tests/memory-code-host.ts`: a `writers?: string[]` option, compared without regard to case, with `canWrite` honoring `fail` like every other method. With no `writers`, only `owner` can write, so today's fixtures keep passing where the author is the owner. With `writers` set, only the names in it can write.
- `tests/memory-tickets.ts`: a `deciders?: string[]` option for `mayDecide`, on the same terms: with none, only `owner` may decide; `fail` is honored.
- `src/ticket.mts`: an `answers` case. It reads the ticket, asks `mayDecide` once for each distinct author among the comments without the agent mark, and prints the kept comments with the comment part of `formatTicket`, pulled out so both use one function. `answers` joins `READS_AND_WRITES` (about line 395), so a failure prints nothing on standard output, and `USAGE` (about line 563). `src/cli.mts`: `answers` joins `TICKET_STEPS` (about line 18); its argument is the default `N`.
- `src/pr.mts`:
  - `Report.ownerLogin` (line 64) becomes `Report.approvers: string[]`. `readReport` (about line 178, which sets it at line 202) fills it by asking `canWrite` once for each distinct author among the reviews and each unresolved thread's last comment. A rejection is not caught, so the command fails as any failed read does.
  - `ownerReviewsToWork` (line 78) becomes `approverReviewsToWork`, and it and `formatReport` (lines 141 and 151 to 154) test `r.approvers.includes(author)`. Both stay pure.
  - `reviewPending` (about line 327) loses its `owner` parameter, which line 497 passes, and asks `p.canWrite(review.author)`.
  - The `comments` case (about line 515) takes `--from-approvers`, asking once per distinct author.
  - `USAGE` (line 288) and the header comment name the new flag, and so does `PR_ARGS.comments` in `src/cli.mts` (line 96). The header comment's `review-pending` line (line 11) and the comment above `reviewPending` (about line 322) say "an approver's review".
- `src/review-verdict.mts`: `senderIsOwner` (lines 34, 99, and 197) becomes `senderIsApprover`. `main` sets it only for a `labeled` event whose label is the override, from `pulls.canWrite(event.sender.login)`. `Decision` gains `explainRemoval?: "not an approver" | "could not check"`, which `decide` sets beside `removeOverride` for a refused label, and `main` posts the matching comment after removing the label (about line 213). A rejected lookup is read as not an approver with `"could not check"`, and `main` throws the reason after posting the status, removing the label, and commenting. `decide` stays pure, and `OVERRIDDEN`'s description (line 58) changes.
- `src/lib/work-status.mts`: `parseCosts` (line 182) and `issueCost` (line 200) lose their `owner` parameter. A comment's markers count when its body has `AGENT_MARK` or its author is `CI_BOT`. The comment above `parseCosts` says so.
- `src/board.mts`: `planSync` (line 403) loses its `repository` parameter, which it used only for the owner (lines 410 and 420), and `apply` (line 690) stops passing it. No snapshot field is added, and the sync asks the code host nothing new.
- Tests that pass the dropped arguments: `tests/status-lib.test.ts` (about lines 1085 to 1167), `tests/board.test.ts` (about lines 423, 475, 487, and 528), and `tests/columns.test.ts` (about lines 459, 481, 494, 576, and 1259). `npx tsc --noEmit` names any other.
- Skills and the agents, changed in the source and copied with `node bin/factory.js sync`, except `dx-first`, which is this repository's own and is edited where it is:
  - `skills/factory-address-review/SKILL.md`, section 0a (about lines 95 to 117) and "Outside a run started by a review": drop `OWNER_LOGIN`. An approver's reviews and turns are what `factory pr state` and `factory pr review-pending` already report; quote the new output strings. A comment without the agent mark from an account those commands count is an approver's. The sentence on why reviews are all `COMMENTED` keeps its reason and says "an approver who is the pull request's author". Section 4's "tells its own words from the owner's" becomes "from an approver's". Every line that quotes a renamed output string quotes the new one: step 3 of the review-started run (about line 142, "Nothing of an approver's in it", and "a review by someone who is not an approver"), and the report's two labels (about lines 207 and 208, `approver review bodies to answer` and `approver's turn`). The rest of the skill keeps "the owner's review" as the name of the run, which the workflow's prompt uses.
  - `skills/factory-resolve-conflicts/SKILL.md`, step 3 (about lines 76 to 88): `factory pr comments N --from-approvers --contains "conflict-stop head=HEAD_SHA"` in place of `--author "$OWNER_LOGIN"`, and reword the sentence after it, since the stop comment may be an agent account's. Its opening (about line 14) says "who is an approver" for "the owner's login".
  - `skills/factory-refine/SKILL.md` (about lines 99 and 331): the answers are the comments `npx --no-install factory ticket answers N` prints, and a comment round's replies are those it prints after the round.
  - `agents/factory-ticket-readiness.md` (about lines 42 and 75): "a reply `factory ticket answers N` prints" for "any reply from the repository owner", and "an answer it prints" for "a comment by the repository owner".
  - `.claude/skills/dx-first/SKILL.md` (about line 215): the same change as `factory-refine`.
- No workflow changes. `workflows/factory-review-verdict.yml` already passes `GITHUB_TOKEN`, which can read the access level and comment. `workflows/factory-review.yml` keeps "the owner's" in its comment and its prompt: neither is an output string, and a workflow change is the owner's to make.
- Docs: the lines the Spec names, as "Proposed docs" words them: `docs/configuration.md` (the `approvers` section, about lines 1143 to 1162, and every link to it), `docs/developing.md` (the row at about line 72), `docs/limitations.md` (about lines 30 to 32 and 129 to 131), `docs/existing-repo.md` (about lines 343 to 345), `docs/glossary.md` (about lines 36 to 38), `docs/cli.md` (the ticket table near line 142, and lines 189 and 195), and `docs/builds.md` (near line 63). `docs/workflow.md` line 178 already says "an approver overrode it" and stays.

## Contracts

- Output strings, exactly: `pending`, `nothing to do: review REVIEW is not an approver's`, `nothing to do: review REVIEW is the factory's own reply: nothing of an approver's in it`, `approver review bodies to answer: K`, `, approver's turn`, `#N has no answers from an approver yet.`, `Overridden by an approver`, and the two `Removed` comments in Spec 16 and 17.
- `factory pr comments N [--author LOGIN] [--contains TEXT] [--from-approvers] [--json]`.
- `factory ticket answers N`.
- No setting, no environment variable, and no secret is added. `tests/config.test.ts` line 189, which expects `approvers: unknown key`, stays as it is.

## Edge cases

- Logins compare without regard to case inside `writeAccess` and the in-memory adapters; nothing above the two interfaces compares a name.
- A review by `github-actions[bot]`, or by the review app, is not an approver's: its `permission` is `none`.
- A deleted account's comments show as `ghost`, which has no access.
- An approver's comment that carries the agent mark is the factory's own, including a teammate's local session posting through their account. `factory ticket answers` leaves it out; `factory pr comments --from-approvers` keeps it.
- One command asks once per distinct author, so a ticket with many comments from three people makes three lookups.
- The override: `decide`'s default branch honors a label already on the pull request without asking who added it, so a failed lookup has to remove the label (Spec 17), not leave it for a later event to honor.
- A cost marker quoted inside a fenced block still does not count, as today: `linesOutsideFences` is unchanged.

## Risks and rollback

- Every account with write access can now steer a session on a pull request and a ticket, and pass the verdict. That is the intent; a repository that gave write access widely should know it, and the release notes say so.
- A cost comment's author is no longer checked. The worst case is a wrong number on the board.
- If the lookup starts failing on a code host, nobody is obeyed and the commands say why. Reverting the release restores the name-before-the-slash rule, and nothing is stored.

## Dependencies

None, and no owner-only step.
