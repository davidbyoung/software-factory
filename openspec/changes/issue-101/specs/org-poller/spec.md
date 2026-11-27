## MODIFIED Requirements

### Requirement: A repository that sets its own trigger

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A repository that sets its own trigger

- **WHEN** `factory poller --once --preset FILE` comes to a repository with a ticket in the ready column
- **THEN** before that repository's pass it reads the repository's `.claude/factory.yaml`, `.claude/factory.lock`, and `.claude/factory.choices.yaml` on its default branch, and takes the `builds.trigger` they give in effect: the file's own key, else the presets it pins, with the choices where two disagree, else `manual`. When that is a value other than `github-action`, it starts none of the repository's tickets and logs `OWNER/NAME: builds.trigger is VALUE there, so its tickets are left`, with no warning mark. A repository whose settings file is missing, or whose files cannot be read or combined, is polled, and gets today's comment when its build cannot start.
