# Proposal

From [davidbyoung/software-factory#89](https://github.com/davidbyoung/software-factory/issues/89).

## Why

`verdict-override` is the one label the factory uses that nothing creates. A person adds it to a pull request to pass the automated review's verdict for one commit, and no session, command, or workflow ever adds it. So in a new repository with the review on, a person told to add it looks in GitHub's label picker and it is not there.

Every other label is created when the factory first adds it, because GitHub creates a missing label then. `ensureLabel` in `src/tickets/github.mts` is empty for that reason.

The docs say otherwise:

- `docs/configuration.md`, `code-host.labels`: the rules under `tickets.labels` hold there too, and one of them is "You don't create the label."
- `docs/github/reference.md`: the row of labels the factory creates lists `verdict-override` as created at "First use".

Decisions:

- **When the label is created:** by the job that posts "Review verdict", on the first pull request event after the review is on. Not by `factory init`. That job already has the permission, reads the settings from the default branch, and runs in every repository with the review on, so a preset, a rename, and a repository set up earlier need nothing more, and `init`, `doctor`, and `sync` do not change.
- **Its look:** red (`b60205`), with the description "Passes Review verdict for the current commit; a push removes it".
- **A failure to create it** never changes the verdict. The run's log says why.
- **`factory remove` and the docs also name `factory`,** which both leave out today.
- **Track:** small: no `spec` label, and each behavior gets one test. The Spec section below is only the line of the `remove` spec this makes false. Nothing here changes what triggers a step, who runs, or when.
- **Build order:** waits on nothing, and nothing waits on it. No owner-only step.

## What Changes

Once the automated review is on in a repository, the label that passes its verdict exists there, under the name `code-host.labels.verdict-override` gives, so the person who needs it can pick it. A label that already exists is left as it is, with its own color and description, and one that exists in other capitals counts as the same label.

The two docs pages then say what is true of each label.

## Capabilities

### Modified Capabilities

- `remove`
