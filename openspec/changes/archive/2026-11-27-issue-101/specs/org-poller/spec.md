## MODIFIED Requirements

### Requirement: A repository that sets its own trigger

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A repository that sets its own trigger

- **WHEN** `factory poller --once --preset FILE` comes to a repository with a ticket in the ready column
- **THEN** before that repository's pass it reads the repository's `.claude/factory.yaml` on its default branch and, when the file sets no `builds.trigger` of its own, its `.claude/factory.lock` there, whose settings in effect give the trigger from the presets it pins, with the choices where two disagree, else `manual`. When the trigger is a value other than `github-action`, it starts none of the repository's tickets and logs `OWNER/NAME: builds.trigger is VALUE there, so its tickets are left`, with no warning mark. A repository is polled, and gets today's comment when its build cannot start, when its settings file is missing or cannot be read, or when the file sets no trigger and its lock is missing, cannot be read, records no settings, or does not pin a preset the file lists.
