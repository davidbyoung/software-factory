## MODIFIED Requirements

### Requirement: The check reads a preset whose commit changed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The check reads a preset whose commit changed

- **WHEN** the check runs on a pull request
- **THEN** On a pull request, the check reads a preset's repository only for a preset whose commit differs from the base branch's lock. It fails with the first line under "A pin changed by hand" when the lock does not match that commit, its `poller` line included, and with the second when a preset's settings, hashes, or `poller` line changed and its commit did not.
