# Proposal

From [davidbyoung/software-factory#86](https://github.com/davidbyoung/software-factory/issues/86).

## Why

`factory preset check` checks that a preset's keys exist and that a preset may set them, and not that their values are valid. So an owner who edits `factory-preset.yaml` by hand sees the check pass on a file that nothing can use.

Each of these, under `code-host`, passes with exit 0:

| The line                         | What the check prints                       |
| -------------------------------- | ------------------------------------------- |
| `branch-name: {ticket}`          | `factory-preset.yaml   no agents or skills` |
| `branch-name: "feature"`         | `factory-preset.yaml   no agents or skills` |
| `branch-name: "{nope}/{ticket}"` | `factory-preset.yaml   no agents or skills` |

`presetSettings` in `src/poller.mts`, which reads an organization's preset for its poller, refuses all three, such as:

```text
factory-preset.yaml: code-host.branch-name: is a map, not a pattern. Quote it: branch-name: "{ticket}"
```

So once such a preset is merged in an organization's `factory-config`, each of the poller's passes prints that line and exits 1, and moving a ticket to Ready starts nothing in any repository. Unlike a repository, where a preset's change arrives as a pull request, the poller reads the preset as merged.

`branch-name` is only the example: `presetFaults` in `src/preset.mts` checks which keys a preset has, `version`, and that no plugin is turned off, and no other value.

What should happen:

`factory preset check` fails on a value that `factory config check` would refuse in a repository, in the same words, with the preset's file named, as it does for an unknown key:

```text
factory-preset.yaml: code-host.branch-name: is a map, not a pattern. Quote it: branch-name: "{ticket}"
```

A preset that leaves a setting out still passes, since a repository or another preset can supply it. An agent or a skill it names and does not ship stays a note and not a failure.

Settled in refinement:

- **Columns.** A preset may hold part of `tickets.columns`, and may leave out any other setting another layer can supply.
- **Where the check runs.** Running it on a pull request in `factory-config` is left out of this ticket.

Found while drafting #85.

Decisions:

- **Scope:** wider than the title. The owner asked that a preset, `.claude/factory.yaml`, and `factory init` be checked consistently, and by one copy of the rules, so this ticket covers every reader in the table under "What is checked today, and what changes".
- **One copy of the rules:** `parseSettings` holds every rule both kinds of file share. A preset leaving settings out is a switch on it. Only the rules `factory.yaml` has no equivalent of stay apart: the three settings a preset can't set, naming another preset, and turning a plugin off.
- **Two bad values in one file:** the first is printed, and the next one after it is fixed, as `factory config check` does.
- **Settings left out:** a preset passes when another layer could supply what it lacks, as the table under "What still passes" lists. Two settings the same file writes that contradict each other fail.
- **The poller reads a preset by the same reading,** so a preset that passes `factory preset check` is one it can read. It stops refusing the presets in that table.
- **A bad value the repository's own file replaces:** the preset is refused when it is added or updated. `factory sync` and `factory config check` check the values in effect, as today, so a preset already pinned does not stop a repository that works.
- **Running the check on a pull request in `factory-config`:** not in this ticket. It would add a trigger to a file existing organizations would edit by hand, and need a required check.
- **Build order:** nothing has to come first, and nothing waits on this. #63 and #70 touch the same files, which is at most a merge conflict.

## What Changes

- `presets`: Preset check refuses a value that is not valid; Every problem only a preset has, then the first fault; A preset that leaves out the board; A preset that holds part of the columns, or no branch name; An interval with no trigger; A spec check with no spec tool; A reviewer whose setting another layer supplies; Part of site, or of coverage; A value that is not valid beside a setting left out; Two settings of one preset that contradict; A preset in the older version; A preset's file that is not YAML; Preset add refuses a value that is not valid; A pinned preset's value in effect; A pinned preset's value that is replaced; A preset and a repository valid alone and not together.
- `updates`: Update refuses a commit whose preset is not valid; An update refused under pull requests.
- `tool-setup`: A re-run names the settings file once; A re-run on a file that is not YAML; A re-run where a pinned preset is not valid.
- `org-setup`: An organization's preset that is not valid.
- `org-poller`: The poller reads a preset that leaves settings out; The poller words a fault as the check does; An interval the poller cannot run on.
- `settings`: GitHub as a host is named with its file; One set of words for every reader.

Not doing: running the check on a pull request in `factory-config`; printing more than the first bad value of a file; any change to which values `.claude/factory.yaml` accepts; the note for an agent or a skill a preset names and does not ship; a label given another label's default name, which stays refused in a preset too; `factory remove`, `factory doctor`, and the poller's look at a repository's own `builds.trigger`, which read the file for one thing and go on when they can't.
