# Refine a ticket

For someone turning a ticket into a spec with `/lunamill-refine 12`. At
the end the ticket holds every decision, each answered by you or left at
its recommendation, and what a build checks it against.

## `lunamill-refine`

**What it does.** Turns a ticket into something a session can build without
asking anything. It works in two roles: a product manager, who challenges
the ask and brings you only the decisions that are yours, and a tech lead,
who settles everything the code and the rules can answer.

**When to use it.** On any ticket before it is built. A ticket with no
acceptance criteria cannot be built; `lunamill-build` sends it here.

**What it reads.** The ticket and its comments, the open tickets that touch
the same code, the code itself, your project's instructions for the agent
(`CLAUDE.md` files, on [Claude Code](../integrations/claude-code.md)),
and the existing
spec when [`specs`](../reference/settings/specs.md#specs) is on.

**What it writes.**

- The ticket's body: your text first, untouched, then Decisions and
  Acceptance criteria, or a Spec when the change is visible and not
  small. Each of these goes in a ticket field of yours instead, when
  [`tickets.fields`](../reference/settings/tickets.md#ticketsfields) names one.
- Notes on the ticket that move it to "refining" and show it waiting on
  you.
- A blocked-by relationship for each ticket that must be built first.
- For a decision about the look, mockups from your
  [`mockups` plugin](../customize/plugins.md), if you have one.
- **A `## Threats` section** when the ticket names a credential your
  repository does not have, or write access for a workflow: what is
  held, who can reach it, how established tools handle it, and what stays
  exposed. You approve it with the rest. `lunamill ticket refined` refuses
  the ticket without one, and says which name it found:
  `missing: ## Threats, since the ticket names a credential this repository does not have: DEPLOY_TOKEN`.
  Once it is built, its pull request is read too, by the
  [`credentials` policy](../features/credentials-policy.md#lunamills-own-policy).

**How it asks.** In the session if you are there: each decision as a
choice, the recommended answer first. Otherwise as one comment on the
ticket, where anything you leave alone goes ahead as written.

**What it never does.** Move the ticket to Ready unasked. Edit a round of
questions once posted. Ask you something the code or the rules already
answer. Ask more than five questions: more than that means the ticket is
several tickets, and it proposes the split.

**Its check.** The built-in `lunamill-ticket-readiness` agent reads the
result cold, at most twice, and lists what a builder would still have to
ask. Then `lunamill ticket refined` refuses to mark the ticket refined
while its body lacks a section a build reads.

**Your own in its place.** A skill of yours can refine tickets instead, as
the [`refiner` plugin](../customize/plugins.md#refiner), which lists what it has to
leave for the build. To add questions to this one, write them under
"Refining: this repository" in your `CLAUDE.md`.
