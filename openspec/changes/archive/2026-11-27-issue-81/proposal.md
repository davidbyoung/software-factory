# Proposal

From [davidbyoung/software-factory#81](https://github.com/davidbyoung/software-factory/issues/81). The transcripts and docs the owner approved are in the ticket's "Proposed docs".

### What and why

The token `claude setup-token` makes, which the factory stores as `CLAUDE_CODE_OAUTH_TOKEN` for the automated review and for builds in the cloud, lasts a year. Claude Code's documentation calls it "a one-year OAuth token". Nothing in the factory says when that year is nearly up. The first sign is a review or a build that stops at once, with a reason GitHub's log hides.

The owner asked on 2026-11-24, while building #74: "how do i know that the claude tokens won't expire again soon?" GitHub never shows a secret's value, but it does show when a secret was last stored, so the factory can tell how old the stored token is.

This ticket has `factory doctor` say how old the stored token is, and warn before its year is up.

### Done when

- `factory doctor` warns, with a `?` line and the command that replaces the token, once the stored `CLAUDE_CODE_OAUTH_TOKEN` is within a month of a year old, for a secret stored on the repository and for one an organization shares with it.
- Past a year, the line is a `✗`.
- A stored `ANTHROPIC_API_KEY` gets no such line, since an API key has no fixed life.
- The docs say how long the token lasts and what the line means.

### Open questions for refinement

Each is answered in "Proposed docs" below:

- **A developer who is not an owner** sees the date wherever they see the secret's name: both of GitHub's lists, the repository's own secrets and the organization's secrets shared with it, give `updated_at` in the same response, which the doctor already reads. Checked live as an owner on `davidbyoung/software-factory` and `aphiria/sf-check-108`.
- **The GitHub access token** is #114, which waits on this ticket: its expiry is whatever the person chose, so it needs a different way to read the date.
- **A run in GitHub Actions** says so: the session's job prints Claude Code's own refusal as an error on the run, with the command that replaces the token.

### Where

- `src/doctor.mts`, `src/runner/types.mts` and `src/runner/github-actions.mts` (the secrets' names today, and their dates), and `src/agent/claude-code.mts`
- `docs/credentials.md` and `docs/cli.md`
- `openspec/specs/tool-setup/`

### Build order

- This ticket waits on #74, which stores the token for an organization and rewrites the doctor's lines about secrets: building this first would mean writing the check against lines #74 then replaces.

## Decisions

- **Which date counts.** The day GitHub gives as the secret's last storing (`updated_at`), from the same two lists `factory doctor` already reads for names. In a repository a person owns, the `pasted` day the credentials file holds for the repository's owner counts instead when it is earlier. The token stops working by the same calendar day a year later (a 29 February rolls to 1 March), in UTC. A token is made before it is stored, so the day can be early, never late.
- **Who can read it.** Whoever sees the `is set` line: the date is in the same response as the name, so nothing new is asked of anyone. Checked live only as an owner, on `davidbyoung/software-factory` and `aphiria/sf-check-108`; for someone who cannot list the secrets, `doctor` already fails `The secrets can be listed` and prints no day, so the spec holds either way.
- **The month is 30 days.** The warning starts when 30 days or fewer are left.
- **`factory doctor` prints the date on every run**, as a ✓ line, so it answers "when does it end?" in any month (owner's pick, Q2 in the draft).
- **`factory status`, and so a session's start, warn in the last 30 days and after,** and say nothing about the token otherwise (Q3).
- **`factory init` replaces the token itself.** On a personal account it asks about an expiring token before its `Replace them?` question, and either stores the newer token the machine holds or runs `claude setup-token`. It never copies a token in its last 30 days from the machine into a repository. Today's `Replace them?` path stores the machine's old copy again, which is why this is needed.
- **`factory init --org` shows the date in its replace question**, and defaults to yes in the last 30 days.
- **A cloud session's job prints Claude Code's own error**, and, for a refused `CLAUDE_CODE_OAUTH_TOKEN`, the one command that replaces it, told from who owns the repository (Q4). In an organization's repository `factory init` never stores the Claude token, so a refused token there is the organization's.
- **The file's key is `pasted`** (Q5): the day the person gave `factory init` the token, which is all the factory knows.
- **`ANTHROPIC_API_KEY` gets none of this:** an API key has no fixed life.
- **The GitHub access token is #114**, which waits on this ticket (Q6).
- **Build order.** #74, which this waited on, is closed. #114 waits on this ticket, recorded as blocked by #81: it reuses the `pasted` date, the doctor's line about a secret's age, and the warning in `factory status`.
