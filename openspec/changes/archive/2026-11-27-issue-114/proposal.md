# Proposal

From [davidbyoung/software-factory#114](https://github.com/davidbyoung/software-factory/issues/114). The transcripts and docs the owner approved are in the ticket's "Proposed docs".

### What and why

On a personal GitHub account, `factory init` asks for a GitHub access token and stores it as the secret `FACTORY_BOARD_TOKEN`, for a board and builds in the cloud. It also keeps a copy in `~/.config/software-factory/credentials.yaml`. The person chose when the token expires, or chose no expiry, on GitHub's page when they made it. Nothing in the factory says when that day is near. The first sign is the board sync, a build, or a merge that stops working.

#81 does this for the Claude token, whose life is a fixed year, so its end can be worked out from when the secret was stored. That doesn't work here: an access token's expiry is whatever the person picked. GitHub does report it exactly, in the `github-authentication-token-expiration` response header, but only on a call made with that token. The doctor can make such a call with the copy on the person's machine, and not with the repository's secret, which GitHub never shows.

### Done when

- `factory doctor` says when the GitHub access token on this machine expires, and warns, with a `?` line and the command that replaces it, once that is within a month. Past it, the line is a `✗`.
- A token with no expiry gets a line that says so.
- `factory init` does not copy an access token from the machine into a repository when it expires within the month, and asks for a new one.
- The docs say what the line means and how to replace the token.

### Open questions for refinement

Each is answered in "Proposed docs" below:

- **Whether the repository's secret is this machine's token:** `factory init` writes the day you pasted the token beside it. A secret stored on or after that day holds it, since `init` stores it from the machine; one stored before holds an older token, and `doctor` and `status` say so. With no `pasted` day, every secret that holds the token counts as this machine's.
- **`factory status` and the start of a session** warn too, from 30 days before the day, as #81 has them do for the Claude token.
- **A teammate** sees no line: their machine holds no token of yours.

### Where

- `src/doctor.mts`, `src/code-host/github-setup.mts` (the access token's step), `src/code-host/github.mts` (where the scopes header is already read), and `src/lib/credentials.mts`
- `docs/credentials.md`

### Build order

- Waits on #81, which adds the date to the machine's file, the doctor's line about a secret's age, and the warning in `factory status`. Building this one first would mean writing those twice.

## Decisions

- **Where the day comes from:** `factory init` reads it when it checks a pasted token with GitHub, from the `github-authentication-token-expiration` response header, and writes it beside the token on the machine as `expires`, or `never` when the response has none. `factory doctor` and `factory status` read only that day, never the token, so "only `factory init` reads a token from the file" (#74) still holds (owner's pick, Q1). The header is documented by GitHub; it could not be read live during refinement, since a session may not read the credentials file.
- **Which secrets hold the machine's token:** one whose `updated_at` day is on or after the `pasted` day the file holds for the token, since `factory init` stores it from the machine. One stored before holds an older token, whose day the machine no longer has, and `doctor` and `status` say so. With no `pasted` day, every one counts as the machine's.
- **`pasted` is written for every token `factory init` keeps on the machine,** the GitHub access token as well as #81's Claude token.
- **The month is 30 days,** as in #81.
- **A secret older than the machine's token gets a `?` line,** even for someone who uses a different token in each repository on purpose (Q2).
- **The token step suggests 90 days,** since GitHub's page defaults to 30 and its address cannot set the expiry (Q3).
- **A run that fails on an expired access token keeps GitHub's own `Bad credentials`** (Q4): it fails in several jobs, and the warning a month ahead is the fix.
- **Only a repository a person owns:** an organization's runs use its app's tokens.
- **Build order:** waited on #81, recorded as blocked by it, which is now closed. It reuses #81's `pasted` day, its doctor line's place, the warning at the end of `factory status`, `factory init`'s question before the other secrets, and `src/lib/claude-token.mts`. #81's pull request is #120.

## Terms the Spec uses

DAY, STORED, and PASTED are `YYYY-MM-DD` in UTC. WHEN is the whole days from today to DAY, printed `in 1 day`, `in N days`, or `today` for 0, as #81 prints it. The token's secrets are the names `factory init`'s step for the token stores it under for the parts on, of `FACTORY_BOARD_TOKEN`, `FACTORY_BUILD_TOKEN`, and `FACTORY_AUTOMERGE_TOKEN`; one set but read by no part, such as `FACTORY_BUILD_TOKEN` beside a board, is not one. NAMES are the token's secrets that are set on the repository and hold the machine's token, joined as `A`, `A and B`, or `A, B, and C`. OLDER are those set on the repository that do not, joined the same way, with `is` for one and `are` for more. A secret holds the machine's token when its `updated_at` day is on or after the file's `pasted` day for the token, or when the file has no `pasted` day for it.
