# Design

From the issue's "Design", with the decisions in proposal.md.

## Where it goes

- **`src/setup.mts` (new):** the contract every tool's setup fills. A starting shape; adjust names freely, but keep what each field carries:

  ```ts
  /** A secret or value is needed for a part that is on, or always (part null). */
  export type Need = { part: Part | null; anyOf: string[] };

  export type SetupStep =
    | {
        kind: "value";
        /** Its key under the tool's kind's block, such as `site` under `tickets`. */
        key: string;
        part: Part | null;
        ask: string;
        fallback?: string;
      }
    | {
        kind: "secret";
        /** What satisfies it: per part, any one of these names being set. */
        needs: Need[];
        /** The names a pasted value is stored under. */
        storeAs: string[];
        /** Lines printed before it is read, after a blank line. */
        intro: string[];
        get?: { page: string } | { command: string[] };
        /** The masked prompt, such as "Paste it (leave empty to do this later):". */
        prompt: string;
        /** Printed when nothing is pasted, before "Run ... init again to add it." */
        skipped: string;
        /** Resolves to lines to print and the account it belongs to, when the
         * tool knows; rejects with the whole line to print before asking again. */
        verify?: (
          value: string,
        ) => Promise<{ lines: string[]; account?: string }>;
        /** Printed after it is stored, such as "Stored as NAME." */
        stored: (names: string[], account?: string) => string;
      };

  export type SetupContext = {
    parts: Part[];
    /** The name of each kind's chosen tool. */
    tools: { codeHost: string; tickets: string; runner: string; agent: string };
    settings: Settings | null;
    /** The repository's root, for a tool whose configuration is a file in it. */
    root: string;
    hasCommand: (name: string) => boolean;
  };

  export type ToolSetup = {
    /** Its row under Found, such as "Claude Code, which is not installed: ...". */
    found(context: SetupContext): string;
    steps(context: SetupContext): SetupStep[];
    checks(
      context: SetupContext & { secrets: string[] | null },
    ): Promise<Check[]>;
    /** What `factory remove` prints as left to remove by hand, outside the repository. */
    leftovers(context: SetupContext & { secrets: string[] | null }): string[];
  };
  ```

  Move `Check` from `doctor.mts` to here.

- **The registries.** One object per kind lists what is available by name: label, how to open it, its `setup`, the settings keys it adds under `tickets` (a ticket system only), and, for a code host, its `parseRemote`. Put them where `config.mts` can import them without a cycle: `src/tickets/index.mts` imports `config.mts` today, so a `src/tools.mts` that imports the implementations and their setups, and which `config.mts` imports, is the likely shape. Every function that reads a registry takes it as a parameter, with the production registry as the default: `parseSettings`, `openTickets`, `openCodeHost`, `openRunner`, and the `unsupported*` messages. `InitDeps` and `DoctorDeps` get a `tools` field, and `InitDeps.open` takes the chosen names beside the repository, since the choice (line 8) comes before it is called. A test passes a registry with the fake added, and production code exposes no way to register a tool at runtime. `Settings.tickets.type`, `codeHost.type`, and `builds.runner` widen from literals to `string`.
- **A tool's own settings.** `SETTINGS_KEYS.tickets` becomes today's keys plus the chosen type's declared keys. `parseSettings` keeps those values in `Settings.tickets.options` (a string record), which `steps` and `checks` read through `context.settings`. `settings.schema.json` lists only what the production registry declares, which is nothing new, so `tests/settings-schema.test.ts` holds unchanged.
- **`src/agent/` (new):** `types.mts`, `claude-code.mts`, and `index.mts`, laid out like the other kinds. `TOOLS.agent`, `AGENT`, and the `claude setup-token` and API-key branch of `src/init.mts` become Claude Code's one secret step. It needs `{ part: "review", anyOf: [CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY] }` and the same for `cloud`, and `storeAs` is the token when `hasCommand("claude")`, otherwise the key. Its `intro`, `get`, `prompt`, and `skipped` are today's strings. `skipped` is `No NAME stored.` with the stored name.
- **Claude Code's configuration** belongs to `src/agent/claude-code.mts`. Its `checks` are lines 25 to 27, built on `sync`'s exported `IMPORT_LINE` and `CLAUDE_MD` and on `isFactory`, and on `hasCommand("claude")`. The module also exports how its configuration is taken out, which `remove` calls through the agent registry: the hook entries and the import line. A second agent brings its own checks and its own removal. `DoctorDeps` gains `root` and `hasCommand` for the context. Its lines print after the runner's, in the order of line 25.
- **The GitHub code host's setup** takes the access-token loop. Its one secret step needs `cloud`: `[FACTORY_BUILD_TOKEN, FACTORY_BOARD_TOKEN]`, `board` and `from-board`: `[FACTORY_BOARD_TOKEN]` only when the ticket system is `github`, and `auto-merge`: `[FACTORY_AUTOMERGE_TOKEN]`. Its `storeAs` is today's `tokenNames(parts)`, and its page is `newTokenPage(scopesFor(needs))`, with the board's scope only when the ticket system is `github`. The scopes it asks for and checks are for every part on, not only the unmet ones, as today. Its `intro` is today's "An access token: opening …" and "Check that … ticked" lines, and `skipped` is `No token stored.` Its `verify` is today's `tokenOwner` and scope check. It rejects with today's whole "That token lacks …" line, or the `tokenOwner` error with ". Paste another." appended, as now, and resolves with the "does not say what this token may do" line when the scopes are unknown, and `account`. `stored` is today's "It belongs to … Stored as …" line. Its `found` is "GitHub (from your git remote)", and its `checks` is today's "Signed in to the code host as …" line.
- **GitHub Issues' setup** has no steps. Its `checks` is today's board check. **GitHub Actions'** has neither.
- **`src/init.mts`** keeps the parts, the board, the signing key, the repository settings, the plan, and the closing list. The chooser questions (line 8) go right after `Found`. `value` steps are asked after the parts and the board, before the plan. Secret steps run after "Go ahead?" where the agent and token blocks are now, in the order agent, code host, ticket system, runner. A step is asked when replacing, or when one of its needs for a part on (or a `part: null` need) has none of its names set. Its value is stored under each `storeAs` name not set, or every one when replacing, which is today's rule for the token. `init` keeps the `account` that `verify` returns for the signing key, as it keeps `tokenAccount` now.
- **`src/parts.mts`:** `neededSecrets(parts)` becomes the needs of the chosen tools' secret steps for the parts on, plus `part: null` needs, plus the factory's own `signing: [FACTORY_SIGNING_KEY]`, which is no tool's. `partsOn` finds cloud builds on when every need for `cloud`, from the steps computed with `parts: ["cloud"]`, is met. That gives today's `has(AGENT) && has(ACCESS)` and is not circular. `tokenNames` and `tokenNeeds` move to the GitHub code host's setup. The exported secret-name constants stay, since the poller and workflows read them.
- **`src/doctor.mts`** keeps its own lines and today's order: settings, files, version, then the code host's `checks`, then "The secrets can be listed", which stays doctor's own, since its result is the input to the rest. Then the per-part lines from `neededSecrets`, then `part: null` needs as `NAME is not set, for <the tool's label>`, then the ticket system's `checks`, the runner's, and the agent's.
- **`src/remove.mts` (new),** wired in `src/cli.mts` like `init`, with a `RemoveDeps` of `root`, `ask`, `out`, `tools`, and `secretNames`, so the tests run it against the memory fakes. Its file list is the "Removing it" column of `docs/github/reference.md`, read as the spec. The hook entries are those `isFactory` in `src/sync.mts` recognizes; export it, since it is private now. The import line is `sync`'s exported `IMPORT_LINE` in `CLAUDE_MD`. Reuse both rather than matching text again. The leftover lines come from each chosen tool's `leftovers`, in the order agent, code host, ticket system, runner, followed by the factory's own: the labels and `npm uninstall`. The GitHub code host's are the ruleset and its secrets that are set. GitHub Issues' are the board's fields. Claude Code's are its secrets that are set. A secret is named only when `secretNames` lists it. When the code host cannot be reached, it says the secrets could not be listed and names every one the tools store.
- **The trial** runs after everything else is built and green, from a tarball of the branch (`npm pack`), since the published version lacks `remove`. The build creates the repository with `gh repo create davidbyoung/factory-trial --private`. The agent is a fresh `general-purpose` agent whose prompt holds only the repository's path, the tarball's path in place of the npm install line, and "follow README.md and docs/quick-start.md; leave every token empty; report every step the docs did not prepare you for".
  - **Installing.** The tarball stands in for the release this pull request becomes, so the agent is told that one substitution, and a report line about it is not a defect. A line about the quick start's or `README.md`'s "not published" marks is #9's to fix: list it in the body and leave it.
  - **Where it runs.** Builds here start from a local session (`builds.trigger: manual`), whose `gh` is signed in as the owner and can create the repository. If `gh repo create` is refused, stop at task 7, say so in the pull request, and ask the owner to create the repository.
  - **What ends it.** A doc defect is fixed in the docs. A code defect in `init`, `doctor`, or `remove` is fixed in this pull request, with a test that reproduces it. Any other code defect becomes a line on the follow-ups issue. If any fix changed a step, the agent runs once more on a fresh clone. After that second run, whatever it still reports goes in the body as follow-up lines, and the trial ends. There is no third run.
- **Docs:** `docs/developing.md` gets "What a tool asks `init` for", with the step types and the fake as its example. "Adding a ticket system" points to it, and the table's "Another ticket system" row says the setup contract is built.

## Contracts

No change to a setting a user writes, a secret's name, a command's output for today's tools beyond the edge under Decisions, or an exit code. The fake ticket system is `fake`, labeled "Fake Tickets", and exists in tests only. It declares the key `site`, with one `value` step ("Your ticket system's address", `part: null`) and one secret step (`FAKE_TICKETS_TOKEN`, `part: null`) whose `verify` refuses the value `bad` with "That token is refused.". Its `checks` fails with "Fake Tickets cannot be reached" when `site` is `down`.

## States

n/a: `init` and `doctor` keep their flow, and the steps add no state of their own.

## Edge cases

- A tool with no steps adds nothing to the plan.
- Two steps whose `storeAs` overlap: the earlier, in the order above, wins, and the later stores only what is left. The fake must not reuse a GitHub name.
- A `value` step whose part is off is not asked. Turning that part off removes its key, as `remove` does for the board's keys today.
- Ctrl-C during a step keeps today's "Stopped. Nothing after the last step shown was changed."

## Risks and rollback

The risk is that `init` or `doctor` changes for today's users without anyone noticing, since most of this is a refactor. The transcript tests in 1.1 and 1.2 are written first, against today's code, so they catch that. Rollback is reverting the pull request: no setting or secret changes shape.

## Dependencies

No blocker. No owner-only step before the build. After it, the owner deletes `davidbyoung/factory-trial`, which the pull request body reminds them to do.

## Where the build departs from this design

- **No `src/agent/types.mts`.** A coding agent has nothing to do beyond its
  setup, so `src/agent/` holds `claude-code.mts` and `index.mts` only.
- **The names the settings accept are in `src/tool-names.mts`,** not read
  from the registry: `config.mts` importing `tools.mts` would import every
  tool's implementation, some of which import `config.mts`. A test keeps
  the two equal.
- **`found` takes only `hasCommand`,** since init prints Found before it
  opens any tool.
- **A setup has `unconfigure` too:** the tool's own files with the
  factory's part taken out, which `remove` writes. Claude Code's are its
  settings without the factory's hooks and `CLAUDE.md` without the import.
- **`remove` prints leftovers code host first,** then ticket system,
  runner, and agent, so the ruleset that must go first is the first line.
- **`init` writes `tickets.type` or `builds.runner`** whenever the tool in
  use is not the one the setting defaults to, not only after asking: a
  repository whose only ticket system is not GitHub's needs it written.
- **The test-only tools are in one file,** `tests/fake-tools.ts`: Fake
  Tickets, Fake Agent, more code hosts, and a second runner.
- **The rule's name, "Software factory", moved to `src/setup.mts`,** since
  both `init` and GitHub's leftovers name it.
