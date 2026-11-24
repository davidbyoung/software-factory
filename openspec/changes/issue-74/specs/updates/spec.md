## MODIFIED Requirements

### Requirement: The Updates job

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The Updates job

- **WHEN** the Updates job runs
- **THEN** The Updates job runs it at 01:00, 13:00, and 19:00 UTC and by hand, with a token of the App's where the App's key and `FACTORY_APP_CLIENT_ID` reach the run, and with the build token otherwise, and its commits are named and signed as a build's are: under the App, the committer is the App's bot and nothing is signed. With neither it looks for nothing, prints the line under "With a part off", and passes.

### Requirement: What factory update prints last

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What factory update prints last

- **WHEN** `factory update` ends
- **THEN** It ends `✓ Wrote N files. Commit them on a branch and open a pull request.`, adding ` and deleted M` after `files` when it deleted any; and `1 file` for one. With nothing to do it prints `✓ Nothing to update: the factory is VERSION, the newest release`, then `.` with no preset, `, and NAME is at its newest commit.` with one, `, and both presets are at their newest commits.` with two, and `, and all N presets ...` with more. It exits 0. In the factory's own repository it moves presets only, and with no settings file it prints `.claude/factory.yaml is missing. Run: factory init` and exits 1, unless the checkout has `.github/workflows/factory-poller.yml`, where it does what `org-poller` says.
