# Proposal

From [davidbyoung/software-factory#73](https://github.com/davidbyoung/software-factory/issues/73).

## Why

Today the factory is a dev dependency of every repository. Each one carries a `package.json` entry, about ten workflow files, and its presets as npm packages, and every release of the factory changes all of them. A Go or Python repository needs a `package.json` only for the factory (`docs/limitations.md`), and a private preset needs a registry's credentials in every workflow, which is why #31 exists.

This ticket changes how one repository holds the factory:

1. **The factory is installed once on a machine,** and the `factory` command runs the version each repository names.
2. **A preset comes from a repository, not from npm.** It is named `owner/repo`, or `owner/repo//folder`, and pinned to a commit in the lock.
3. **Two short workflow files replace about ten.** They call the factory's own workflow at one exact version.
4. **The factory opens its own update pull requests,** for a preset and for a new version of the factory.

The factory's skills, agents, rules, and guards stay committed copies in each repository, as today.

It is the first of three tickets from one design, drafted with `dx-first` on #72 and approved by the owner on 2026-11-23. #74, which sets up an organization and a repository, and #72, one ticket across several repositories, both build on it. The research behind the design is a comment on #72.

**Folded in from #69.** The shared workflow has to decide, job by job, what runs when a part is off, which is what #69 was about. Today every repository is treated as having builds in the cloud and the review on:

- **No build token.** A repository set up with no parts and no secrets, as the quick start says to, gets `factory-conflicts.yml`. It runs on every push to the default branch and nightly, and fails with "No build token" before it checks whether there is work.
- **The verdict waits forever.** With the automated review off, every pull request carries a "Review verdict" status that stays pending: `decide()` in `src/review-verdict.mts` waits for a review that never comes.
- **The commands wait too.** `reviewExpected` in `src/pr.mts` expects a review on every ready pull request, without reading the review setting. So `factory pr state`, `factory pr watch`, and `factory-address-review` wait for one.

#69 asked whether to write a workflow only when its part is on, or to keep writing it and have it pass or skip. Q9 answers that: the two files are always written, so each job in the shared workflow passes or is skipped when its part is off.

Done when, beyond the draft in the ticket's "Proposed docs":

- A repository with the review off gets no "Review verdict" status that waits forever, and `factory pr state` and `factory pr watch` expect no review there.
- A repository with no build token gets no run that fails for want of one.
- `rules.md` says a push gets a review only where the review is on.

**Decided by the owner on 2026-11-23:**

- **Presets come from a repository, and npm presets go** (Q2), now, while the factory is before 1.0. This changes a decision of #29.
- **A folder in a preset's repository is written after `//`** (Q10): `foo/presets//bar`, on every code host.
- **Skills, agents, rules, and guards stay committed files, not a plugin** (Q7).
- **Each repository's workflow files name one exact version of the factory** (Q9).
- **Shared settings stay pinned.** A preset's change reaches a repository as a pull request, and it never merges itself.
- **A preset cannot name another preset,** and cannot set `repository`, `auto-merge.allow`, or `auto-merge.commands`, as today.
- **Presets stay optional.** A repository can set anything in its own `.claude/factory.yaml`.
- **Each repository keeps its own `.claude/factory.yaml` and `.claude/factory.lock`.** Nothing about a repository is kept in a central place.
- **Scripts over skill text.** What opens an update's pull request is a script, with no session deciding anything.
- **#69 is folded into this ticket,** decided on 2026-11-23.

## What Changes

- The factory is installed once on a machine. The `factory` command runs the version a repository's `.claude/factory.lock` names, downloading it once into `~/.cache/software-factory/`, and nothing is installed in the repository: `factory init` writes no `package.json` and no `.gitignore` line, except before a spec tool's `npm install`.
- Every skill, agent, rule, workflow, hook, and message names the command `factory`, where it says `npx --no-install factory` today.
- A preset is a folder in a repository, named `OWNER/NAME` or `OWNER/NAME//FOLDER` and pinned to a commit in the lock, which also holds the preset's settings and a hash of each file it ships. `factory sync` works from the lock and reads no preset's repository. An npm preset is refused, and nothing reads an old lock's preset entries or a copy in `node_modules`.
- `factory sync` writes two workflow files, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`, whatever the settings. It overwrites today's `factory-review.yml`, and deletes the ten other `factory-*.yml` files and `.github/actions/factory-agent/`. Each of the two calls the factory's own `run.yml` or `review.yml` at the version the lock names.
- A job whose part is off is skipped. With the automated review off, the "Review verdict" status passes and `factory pr state` and `factory pr watch` wait for no review. A job that would run a session checks for work before it looks for a token.
- `factory init` adds the Actions policy a public repository needs for `pull_request_target`, and `factory doctor` checks it.
- `factory update` is added: it raises the repository to the newest release and moves each preset to its newest commit, and with `--pull-requests` opens one pull request for the factory and one for each preset repository. The Updates job runs it three times a day.
- `factory remove` lists no `npm uninstall` line.
- `docs/presets.md` is rewritten, `docs/updating.md` is rewritten down to "Moving to settings version 2", and the other pages say one install on a machine.

## Capabilities

### New Capabilities

- `machine-install`
- `workflow-files`
- `parts-off`
- `public-repository`
- `updates`

### Modified Capabilities

- `presets`
- `settings-lock`
- `tool-setup`
- `remove`
- `docs`
- `board-poller`
- `board-columns`
- `board-sync-trigger`
- `default-branch`
- `labels-setting`
- `npm-registry-secrets`
- `ticket-keys`
- `cli-output`

## Impact

- `bin/launch.js`, `bin/factory.js`, and `src/cli.mts`: running the version a repository names.
- `src/preset.mts`, `src/preset-commands.mts`, `src/config.mts` (`resolveFiles`), and `src/sync.mts`: the lock, and which files are written.
- `workflows/`, `actions/factory-agent/`, `.github/workflows/run.yml` and `review.yml`, and `src/init.mts`: the workflow files.
- `workflows/factory-deps.yml`, `skills/factory-deps/`, `src/deps.mts`, and a new `src/update.mts`: the update job.
- `src/doctor.mts`, `src/remove.mts`, and `src/code-host/github.mts`.
- `src/review-verdict.mts` (`decide`), `src/pr.mts` (`reviewExpected`), and `rules.md`, from #69.
- The docs: `docs/presets.md`, `docs/updating.md`, `docs/quick-start.md`, `docs/existing-repo.md`, `docs/limitations.md`, `docs/design.md`, `docs/cli.md`, `docs/configuration.md`, and `docs/github/reference.md`.
- Every repository that uses the factory: its CI depends on the factory's repository and npm at run time, where it depended on npm at install.

## Decisions

- **Backwards compatibility: none** (the owner, 2026-11-23). Two repositories use the factory. Nothing reads an npm preset, an old lock's preset entries, or a copy in `node_modules`.
- **How a repository set up today moves over:** by hand, as "Moving to one install on your machine" in the drafted `docs/updating.md` says: uninstall the development dependency, then `factory update`. No command migrates it.
- **How this repository keeps building itself:** its two workflow files call `./.github/workflows/run.yml` and `review.yml`, the same commit's copies, and each job installs the factory from the checkout.
- **How the installed command is updated:** `npm install -g @davidbyoung/software-factory@latest`. It only starts the version a repository names, so it rarely has to be. A version it cannot download stops the command with the line under "One install on a machine".
- **A job checks for work before it checks for a token** (#69's question). With work and no token, a run nobody asked for passes with a notice, and one a person or the poller started fails.
- **`factory update` is added** (the owner): one command for the job and for updating by hand.
- **The automated review reads an update's pull request** like any other (the owner).
- **The `pull_request_target` policy for a public repository is part of this ticket** (the owner). The owner adds it to `davidbyoung/software-factory` by hand before December 2, 2026, since this ticket will not be built by then.
- **The draft's reasoning is a comment** (the owner): "The reasoning behind this draft", moved word for word so the body fits GitHub's 65,536 characters. The two full docs pages are a comment too, for the same reason.
- **The check on a pull request runs under `pull_request`,** from `factory-review.yml`, where the draft had it in `factory.yml`: a fork's pull request cannot be checked out under `pull_request_target` by default.
- **`factory.yml` is longer than drafted:** it needs `permissions`, `run-name`, which `factory build` finds its run by, the inputs for a run by hand, a trigger for the verdict after a review, and today's three schedules. It passes today's secrets: the App is #74's.
- **A run installs a repository's own dependencies only when it has a `package-lock.json`,** so a Node repository changes nothing and any other needs no `package.json`.
- **An update's text is the pull request's description,** and `factory preset check` lists each preset by its file.
- **#74's, not built here:** `factory init --org`, `factory init --preset`, finding `factory-config` by name, the App and its token, and the draft's "Organization ... not set up" lines.
- **Build order:** #74 and #72 each wait on this ticket, recorded on them. This ticket waits on nothing.

**Not doing:** `factory init --org` and `--preset`, the App, and one poller for an organization (#74). A ticket across repositories (#72). A command that migrates a repository. GitHub Enterprise Server. An organization's list of allowed presets, a view of repositories that are behind, GitLab, and a second coding agent, which are on #72's list for later.

**Checked by review, not by a test:** each transcript in the ticket's "Proposed docs" against what the command prints, in the builder's "Mockup and result" comparison in the pull request.
